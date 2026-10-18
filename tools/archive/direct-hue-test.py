import json,pathlib,subprocess,struct,time,colorsys,sys
P=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(P));import hue
AREA='<entertainment-configuration-id>'
AUTH='<application-auth-resource-id>'
cred=json.loads((P/'hue-pairing.json').read_text())[0]['success']
def component(state):
 r=subprocess.run(['node',str(P/'hyperion-api.cjs')],input=json.dumps({'command':'componentstate','componentstate':{'component':'LEDDEVICE','state':state}}),capture_output=True,text=True);print(r.stdout.strip(),flush=True)
p=None
try:
 component(False);time.sleep(2)
 hue.api('entertainment_configuration/'+AREA,'PUT',{'action':'start'})
 log=open(P/'logs/direct-dtls.log','wb')
 p=subprocess.Popen(['/opt/homebrew/opt/openssl@3/bin/openssl','s_client','-dtls1_2','-connect','192.0.2.20:2100','-psk',cred['clientkey'],'-psk_identity',AUTH,'-cipher','PSK-AES128-GCM-SHA256','-quiet'],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
 time.sleep(1)
 old=P/'logs/c920-timing.mov'
 if old.exists():old.rename(P/'logs/c920-before-direct-test.mov')
 subprocess.run(['open','-n',str(P/'CameraTest.app')],check=True)
 start=time.monotonic()
 for phase in ['fixed-sequence','incrementing-sequence']:
  print(phase,flush=True)
  for i in range(180):
   rgb=[round(c*65535) for c in colorsys.hsv_to_rgb(i/180,1,0.7)]
   seq=1 if phase=='fixed-sequence' else i%256
   packet=b'HueStream'+bytes([2,0,seq,0,0,0,0])+AREA.encode()+b''.join(bytes([ch])+struct.pack('>HHH',*rgb) for ch in range(8))
   p.stdin.write(packet);p.stdin.flush()
   target=start+(i+1)/30+(0 if phase=='fixed-sequence' else 6)
   time.sleep(max(0,target-time.monotonic()))
finally:
 if p:p.terminate()
 try:hue.api('entertainment_configuration/'+AREA,'PUT',{'action':'stop'})
 except Exception:pass
 time.sleep(1.5);component(True)
 print('Returned to TV video capture',flush=True)
