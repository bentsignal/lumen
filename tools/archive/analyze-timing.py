import subprocess,pathlib,numpy as np,json
p=pathlib.Path('/path/to/private/lg-hue-setup')
b=subprocess.check_output(['ffmpeg','-v','error','-i',str(p/'logs/c920-timing.mov'),'-vf','fps=30,scale=640:360:flags=area','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
a=np.frombuffer(b,dtype=np.uint8).reshape(-1,360,640,3).astype(float)
# Corresponding top-center and left-middle TV and wall regions, measured from camera frame.
regions={'screen_top':(285,185,350,205),'wall_top':(290,145,350,172),'screen_left':(225,220,245,265),'wall_left':(200,225,215,270),'screen_right':(390,210,405,260),'wall_right':(420,205,440,260),'bottom':(260,302,360,320)}
r={k:a[:,y1:y2,x1:x2,:].mean(axis=(1,2)) for k,(x1,y1,x2,y2) in regions.items()}
for k,x in r.items():
 c=x/(x.sum(axis=1,keepdims=True)+1e-6)
 delta=np.linalg.norm(np.diff(c,axis=0),axis=1)
 print(k,'RGB range',x.min(axis=0).round(1),x.max(axis=0).round(1),'chromaticity deltas p50/p90/p99',np.quantile(delta,[.5,.9,.99]).round(4),'large steps at seconds',(np.where(delta>.025)[0]/30).round(3).tolist())
for side in ['top','left','right']:
 x=r['screen_'+side];y=r['wall_'+side]
 x=x/x.sum(axis=1,keepdims=True);y=y/y.sum(axis=1,keepdims=True)
 x=(x-x.mean(axis=0))/(x.std(axis=0)+1e-6);y=(y-y.mean(axis=0))/(y.std(axis=0)+1e-6)
 scores=[]
 for lag in range(0,91):
  xx=x[:len(x)-lag] if lag else x;yy=y[lag:]
  scores.append(float((xx*yy).mean()))
 print(side,'best lag seconds',np.argmax(scores)/30,'correlation',max(scores))
(p/'logs/camera-timing-measurements.json').write_text(json.dumps({k:v.tolist() for k,v in r.items()}))
