import subprocess,sys,pathlib,json,shlex
P=pathlib.Path(__file__).resolve().parent

def prisoner(command):
 return subprocess.run(['ssh','-tt','-p','9922','-i',str(P/'prisoner-key'),'-o','IdentitiesOnly=yes','-o','HostKeyAlgorithms=+ssh-rsa','-o','PubkeyAcceptedAlgorithms=+ssh-rsa','-o','UserKnownHostsFile='+str(P/'known_hosts'),'prisoner@192.0.2.10',command],capture_output=True,text=True)

def hb(command):
 r=prisoner('luna-send-pub -n 1 luna://org.webosbrew.hbchannel.service/exec '+shlex.quote(json.dumps({'command':command})))
 print(r.stdout); print(r.stderr,file=sys.stderr);return r.returncode
if __name__=='__main__':
 if sys.argv[1]=='hb': sys.exit(hb(sys.argv[2]))
 if sys.argv[1]=='prisoner':
  r=prisoner(sys.argv[2]); print(r.stdout);print(r.stderr,file=sys.stderr);sys.exit(r.returncode)
