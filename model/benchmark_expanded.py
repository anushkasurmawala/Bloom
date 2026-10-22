"""Independent research benchmark. Never changes the app's deployed model."""
import argparse,json
from pathlib import Path
import pandas as pd,numpy as np
from sklearn.model_selection import StratifiedGroupKFold,GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier,ExtraTreesClassifier
from sklearn.metrics import classification_report,confusion_matrix
from xgboost import XGBClassifier
p=argparse.ArgumentParser();p.add_argument('csv');a=p.parse_args();df=pd.read_csv(a.csv);features=list(df.columns[2:-1]);raw=len(df)
# Apply the source's specified physiological quality filters, without consulting labels.
df=df[(df.Age<=100)&df[features[1]].between(95,105)&df[features[2]].between(40,200)].copy()
clean=len(df);df=df.drop_duplicates(subset=features+['Status']);X=df[features];enc=LabelEncoder();y=enc.fit_transform(df.Status)
# Unite patient identifiers and exact-input duplicates, so neither crosses partitions.
parent=list(range(len(df)))
def find(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for vals in [df['Patient ID'].astype(str).tolist(),X.astype(str).agg('|'.join,axis=1).tolist()]:
 seen={}
 for i,v in enumerate(vals):
  if v in seen:parent[find(i)]=find(seen[v])
  else:seen[v]=i
groups=np.array([find(i) for i in range(len(df))]);tr,te=next(StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=20261011).split(X,y,groups));folds=list(StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=7).split(X.iloc[tr],y[tr],groups[tr]));assert not set(groups[tr])&set(groups[te])
rows=[]
models=[('Random forest',RandomForestClassifier(n_estimators=300,random_state=42,n_jobs=1),{'max_depth':[6,None],'min_samples_leaf':[1,3]}),('Extra trees',ExtraTreesClassifier(n_estimators=300,random_state=42,n_jobs=1),{'max_depth':[6,None],'min_samples_leaf':[1,3]}),('XGBoost',XGBClassifier(n_estimators=300,objective='multi:softprob',num_class=3,random_state=42,n_jobs=1),{'max_depth':[2,4,6],'learning_rate':[.05,.1]})]
# Select using training CV; only the chosen family sees the held-out labels.
best=None
for name,m,grid in models:
 s=GridSearchCV(m,grid,cv=folds,scoring='accuracy',n_jobs=1).fit(X.iloc[tr],y[tr]);rows.append({'model':name,'cv_accuracy':s.best_score_,'parameters':s.best_params_});print(rows[-1],flush=True)
 if best is None or s.best_score_>best[1].best_score_:best=(name,s)
pred=best[1].predict(X.iloc[te]);out={'source':'https://data.mendeley.com/datasets/ckhgtgdg4f/1','download':'Springer supplementary CSV, DOI 10.1186/s12911-026-03343-1','raw_rows':raw,'quality_filtered_rows':clean,'deduplicated_rows':len(df),'features':features,'train_rows':len(tr),'test_rows':len(te),'patient_ids_unique':int(df['Patient ID'].nunique()),'groups':len(set(groups)),'split_seed':20261011,'selection':'4-fold patient/exact-input grouped training CV accuracy; single untouched 20% grouped test fold for selected family','candidates':rows,'selected':best[0],'test_report':classification_report(y[te],pred,target_names=enc.classes_,output_dict=True),'confusion_matrix':confusion_matrix(y[te],pred).tolist(),'limitations':['Source labels include automated risk classifications; not prospective complication outcomes.','Feature units appear inconsistent: fasting glucose header says mg/dL but values near 5; HbA1c values near 40 need clarification.','No facility identifiers for external facility validation.','Not suitable for clinical deployment or automatic replacement of current six-input model.']}
path=Path(__file__).parent/'expanded-benchmark.json';path.write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2),flush=True)
# Research artifact retains feature order; never contains names or patient identifiers.
import joblib,hashlib
artifact=Path(__file__).parent/'expanded-research-model.joblib'
joblib.dump({'model':best[1].best_estimator_,'features':features,'classes':enc.classes_.tolist(),'research_only':True},artifact)
out['source_csv_sha256']=hashlib.sha256(Path(a.csv).read_bytes()).hexdigest()
out['model_artifact']=artifact.name
path.write_text(json.dumps(out,indent=2))
