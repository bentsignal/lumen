from __future__ import print_function
import httplib,json,time
c=httplib.HTTPConnection('127.0.0.1',8090,timeout=3)
def call(data):
 c.request('POST','/json-rpc',json.dumps(data),{'Content-Type':'application/json'})
 r=c.getresponse();answer=json.loads(r.read())
 if not answer.get('success'):raise RuntimeError(str(answer))
try:
 start=time.time()
 for i in range(240):
  h=(i%120)/20.0
  x=int(200*(1-abs(h%2-1)))
  rgb=[(200,x,0),(x,200,0),(0,200,x),(0,x,200),(x,0,200),(200,0,x)][int(h)]
  call({'command':'color','priority':50,'duration':1000,'origin':'Hue diagnosis','color':rgb})
  time.sleep(max(0,start+(i+1)/20.0-time.time()))
 print('Direct TV color updates:',240/(time.time()-start))
finally:
 call({'command':'clear','priority':50})
 c.close()
