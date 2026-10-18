from __future__ import print_function
import os, sys, json, time, subprocess, signal, select, fcntl
import policy
BASE=os.environ.get('LUMEN_TV_CONFIG_DIR', '/var/lib/webosbrew/hue-sync')
with open(BASE+'/bridge.json') as config_file:
    CFG=json.load(config_file)
stop=False
ENGINE_PASSWORD=None

def log(s):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), s)
    sys.stdout.flush()

def api(resource, method='GET', data=None):
    args=['curl','-ksS','--connect-timeout','2','--max-time','3','-X',method,
          'https://'+CFG['host']+'/clip/v2/resource/'+resource,
          '-H','hue-application-key: '+CFG['username']]
    if data is not None: args+=['-H','Content-Type: application/json','--data-binary',json.dumps(data)]
    result=json.loads(subprocess.check_output(args, close_fds=True))
    if result.get('errors'): raise RuntimeError(str(result['errors']))
    return result.get('data',[])

def writable(light):
    state={'on':light['on'], 'dimming':{'brightness':light['dimming']['brightness']}}
    gradient=light.get('gradient',{})
    if len(gradient.get('points',[]))>=2:
        state['gradient']={'points':gradient['points'], 'mode':gradient.get('mode','interpolated_palette')}
    elif light.get('color_temperature',{}).get('mirek_valid'):
        state['color_temperature']={'mirek':light['color_temperature']['mirek']}
    elif light.get('color',{}).get('xy'):
        state['color']={'xy':light['color']['xy']}
    return state

def snapshot():
    state={rid:writable(api('light/'+rid)[0]) for rid in CFG['lights']}
    path=BASE+'/normal-state.json'
    with open(path+'.tmp','w') as f: json.dump(state,f)
    os.chmod(path+'.tmp',0o600)
    os.rename(path+'.tmp',path)

def restore(stop_stream=False):
    path=BASE+'/normal-state.json'
    if not os.path.exists(path): return False
    stream=api('entertainment_configuration/'+CFG['area'])[0]
    if stream['status']=='active':
        if not stop_stream: return False
        if stream.get('active_streamer',{}).get('rid')!=CFG['auth_id']:
            log('Another app owns streaming; leaving it alone')
            return False
        api('entertainment_configuration/'+CFG['area'],'PUT',{'action':'stop'})
    with open(path) as state_file:
        saved_state=json.load(state_file)
    for rid,state in saved_state.items():
        # An app may acquire Entertainment after the first check. Never restore over it.
        if any(area['status']=='active' for area in api('entertainment_configuration')):
            return False
        api('light/'+rid,'PUT',state)
    log('Restored ordinary lighting using writable Hue V2 fields')
    return True

def engine(command):
    return policy.engine_request(command,ENGINE_PASSWORD)

def term(sig,frame):
    global stop
    stop=True

if __name__=='__main__':
    os.umask(0o077)
    lock=open(BASE+'/guard.lock','w')
    try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except IOError: sys.exit(0)
    if len(sys.argv)>1:
        if sys.argv[1]=='snapshot':snapshot()
        elif sys.argv[1]=='restore':restore()
        sys.exit(0)
    signal.signal(signal.SIGTERM,term)
    signal.signal(signal.SIGINT,term)
    master,slave=os.openpty()
    luna=subprocess.Popen(['luna-send','-i','luna://com.webos.service.tvpower/power/getPowerState','{"subscribe":true}'],stdin=slave,stdout=slave,stderr=slave,close_fds=True)
    os.close(slave)
    buffer=b''
    was_active=False
    powered=True
    next_check=0
    last_snapshot=0
    next_health=time.time()+5
    last_recovery=0
    controller=None
    server=None
    if os.path.exists(BASE+'/control.json'):
        with open(BASE+'/control.json') as control_file:control=json.load(control_file)
        ENGINE_PASSWORD=control['engine_password']
        with open('/proc/sys/kernel/random/boot_id') as boot_file:boot_id=boot_file.read().strip()
        controller=policy.Controller(BASE,CFG,api,engine,snapshot,restore,boot_id)
        server=policy.serve(controller,control)
    try:
        try:
            if api('entertainment_configuration/'+CFG['area'])[0]['status']=='inactive' and not (controller and controller.state.get('restore_pending')):
                snapshot();log('Saved ordinary lighting baseline')
        except Exception as e:log('Initial snapshot unavailable: '+str(e))
        open('/tmp/hue-state-guard-ready','w').close()
        while not stop:
            ready,_,_=select.select([master],[],[],0.5)
            if ready:
                buffer+=os.read(master,4096)
                while b'\n' in buffer:
                    line,buffer=buffer.split(b'\n',1)
                    try:
                        event=json.loads(line.decode().strip())
                        if 'state' in event:
                            active=event['state']=='Active'
                            log('TV power state: '+event['state'])
                            if controller:
                                if active:controller.power(True)
                                elif event['state'].replace(' ','').lower() in ['activestandby','suspend','off','poweroff']:
                                    controller.power(False)
                            elif powered and not active:
                                try:restore(stop_stream=True)
                                except Exception as e:log('Power-off restore failed: '+str(e))
                            powered=active
                    except ValueError:pass
            now=time.time()
            allowed=powered
            if controller:
                allowed=controller.wants_sync()
            if allowed and now>=next_health:
                next_health=now+5
                try:
                    if controller:
                        _,other=controller.streams()
                        if other:continue
                    info=json.loads(subprocess.check_output(['curl','-sS','--max-time','2','http://127.0.0.1:8090/json-rpc','-H','Content-Type: application/json','-d','{"command":"serverinfo"}'],close_fds=True))
                    priorities=info.get('info',{}).get('priorities',[])
                    if info.get('success') and not any(p.get('priority')==150 and p.get('active') for p in priorities) and now-last_recovery>=15:
                        log('Capture input absent; reconnecting PicCap to Hyperion')
                        for method in ['stop','start']:
                            subprocess.call(['luna-send','-w','3000','-n','1','luna://org.webosbrew.piccap.service/'+method,'{}'],stdout=open(os.devnull,'w'),stderr=subprocess.STDOUT,close_fds=True)
                        last_recovery=now
                except Exception: pass
            if now<next_check:continue
            next_check=now+1
            try:
                if controller:
                    controller.tick()
                    continue
                stream=api('entertainment_configuration/'+CFG['area'])[0]
                ours=stream.get('active_streamer',{}).get('rid')==CFG['auth_id']
                active=stream['status']=='active' and ours
                if was_active and stream['status']=='inactive':restore()
                elif stream['status']=='inactive' and now-last_snapshot>=5:
                    snapshot();last_snapshot=now
                was_active=active
            except Exception as e:log('Bridge check failed: '+str(e))
    finally:
        if server:server.shutdown()
        try:
            if controller:
                controller.stop_restore()
            elif was_active:restore(stop_stream=True)
        except Exception as e:log('Shutdown restore failed: '+str(e))
        luna.terminate()
        os.close(master)
        try:os.unlink('/tmp/hue-state-guard-ready')
        except OSError:pass
