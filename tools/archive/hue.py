import json,pathlib,subprocess,sys
P=pathlib.Path(__file__).resolve().parent

def api(resource,method='GET',data=None):
 cred=json.loads((P/'hue-pairing.json').read_text())[0]['success']
 args=['curl','-ksS','--connect-timeout','5','-X',method,'https://192.0.2.20/clip/v2/resource/'+resource,'-H','hue-application-key: '+cred['username']]
 if data is not None: args+=['-H','Content-Type: application/json','--data-binary',json.dumps(data)]
 r=subprocess.run(args,capture_output=True,check=True);return json.loads(r.stdout)
if __name__=='__main__':print(json.dumps(api(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else 'GET',json.loads(sys.argv[3]) if len(sys.argv)>3 else None),indent=2))
