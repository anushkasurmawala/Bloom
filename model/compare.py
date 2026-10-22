from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold,GridSearchCV
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier,ExtraTreesClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler,LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report,confusion_matrix
from sklearn.dummy import DummyClassifier
from xgboost import XGBClassifier
ROOT=Path(__file__).resolve().parents[1]
df=pd.read_csv(ROOT/'model/dataset.csv').drop_duplicates();features=list(df.columns[:-1]);X=df[features];enc=LabelEncoder();y=enc.fit_transform(df.RiskLevel);groups=X.astype(str).agg('|'.join,axis=1)
tr,te=next(StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=42).split(X,y,groups));assert not set(groups.iloc[tr])&set(groups.iloc[te])
cv=list(StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=7).split(X.iloc[tr],y[tr],groups.iloc[tr]))
models={
 'Decision tree':(DecisionTreeClassifier(random_state=42,class_weight='balanced',min_samples_leaf=5),{'max_depth':[3,4,5,6]}),
 'Logistic regression':(Pipeline([('scale',StandardScaler()),('model',LogisticRegression(max_iter=2000,class_weight='balanced'))]),{'model__C':[0.1,1,10]}),
 'Random forest':(RandomForestClassifier(n_estimators=250,random_state=42,n_jobs=1),{'max_depth':[4,8,None],'min_samples_leaf':[1,3],'class_weight':[None,'balanced']}),
 'Extra trees':(ExtraTreesClassifier(n_estimators=250,random_state=42,n_jobs=1),{'max_depth':[6,None],'min_samples_leaf':[1,3],'class_weight':[None,'balanced']}),
 'XGBoost':(XGBClassifier(n_estimators=200,objective='multi:softprob',num_class=3,eval_metric='mlogloss',n_jobs=1,random_state=42,subsample=1,colsample_bytree=1),{'max_depth':[2,3,5],'learning_rate':[0.03,0.1],'reg_lambda':[1,5]})}
results=[];fitted={}
def evaluate(pred,truth):return {'report':classification_report(truth,pred,labels=[0,1,2],target_names=enc.classes_,output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(truth,pred,labels=[0,1,2]).tolist()}
for name,(est,grid) in models.items():
 search=GridSearchCV(est,grid,scoring={'f1':'f1_macro','accuracy':'accuracy'},refit='f1',cv=cv,n_jobs=1).fit(X.iloc[tr],y[tr]);fitted[name]=search.best_estimator_;result={'model':name,'parameters':search.best_params_,'cv_macro_f1':float(search.best_score_),'cv_accuracy':float(search.cv_results_['mean_test_accuracy'][search.best_index_]),**evaluate(search.predict(X.iloc[te]),y[te])};results.append(result);print(name,round(result['cv_macro_f1'],3),round(result['report']['accuracy'],3),flush=True)
winner=max(results,key=lambda r:r['cv_macro_f1']);name=winner['model'];m=fitted[name]
# Nested evaluation repeats the entire family and parameter selection process.
outer=StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=91);nested_pred=np.empty(len(y),dtype=int);folds=[]
for fold,(a,b) in enumerate(outer.split(X,y,groups)):
 inner=list(StratifiedGroupKFold(n_splits=3,shuffle=True,random_state=20+fold).split(X.iloc[a],y[a],groups.iloc[a]));candidates=[]
 for family,(est,grid) in models.items():
  fit=GridSearchCV(est,grid,scoring='f1_macro',cv=inner,n_jobs=1).fit(X.iloc[a],y[a]);candidates.append((fit.best_score_,family,fit))
 score,family,fit=max(candidates,key=lambda c:c[0]);nested_pred[b]=fit.predict(X.iloc[b]);folds.append({'fold':fold+1,'selected':family,'train':len(a),'test':len(b),'inner_macro_f1':float(score)})
 print('Nested fold',fold+1,family,flush=True)
baseline=DummyClassifier(strategy='most_frequent').fit(X.iloc[tr],y[tr]);summary={'original_rows':1014,'unique_rows':len(df),'train_rows':len(tr),'test_rows':len(te),'labels':enc.classes_.tolist(),'selection':'Highest training grouped CV macro F1; original holdout never used to select model. Holdout was previously inspected in v1, so comparison is exploratory, not a new external validation. Nested grouped CV repeats all model/parameter selection within each outer training fold. No patient identifiers are available; same-patient leakage cannot be ruled out.','models':results,'selected':name,'nested':{**evaluate(nested_pred,y),'folds':folds},'baseline':evaluate(baseline.predict(X.iloc[te]),y[te])}
(ROOT/'model/comparison.json').write_text(json.dumps(summary,indent=2))
def tree(t):
 t=t.tree_;return {'left':t.children_left.tolist(),'right':t.children_right.tolist(),'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'value':t.value[:,0,:].tolist()}
export={'version':'uci-comparison-2','type':name,'features':features,'classes':enc.classes_.tolist(),'ranges':{f:[float(X.iloc[tr][f].min()),float(X.iloc[tr][f].max())] for f in features},'metrics':{'report':winner['report'],'test_rows':len(te)},'source':'https://archive.ics.uci.edu/dataset/863/maternal+health+risk'}
if name in ['Random forest','Extra trees']:export['trees']=[tree(t) for t in m.estimators_]
elif name=='Decision tree':export['trees']=[tree(m)]
elif name=='Logistic regression':export.update(mean=m['scale'].mean_.tolist(),scale=m['scale'].scale_.tolist(),coef=m['model'].coef_.tolist(),intercept=m['model'].intercept_.tolist())
elif name=='XGBoost':
 from xgboost import DMatrix
 trees=[json.loads(t) for t in m.get_booster().get_dump(dump_format='json')];scores=np.zeros(3);v=X.iloc[0].astype(np.float32)
 for i,t in enumerate(trees):
  node=t
  while 'leaf' not in node:
   next_id=node['yes'] if v[node['split']]<node['split_condition'] else node['no'];node=next(c for c in node['children'] if c['nodeid']==next_id)
  scores[i%3]+=node['leaf']
 raw=m.get_booster().predict(DMatrix(X.iloc[:1]),output_margin=True)[0]
 export.update(trees=trees,base_margin=(raw-scores).tolist())
(ROOT/'dist/model-v2.json').write_text(json.dumps(export));(ROOT/'model/prediction-parity.json').write_text(json.dumps({'inputs':X.to_dict('records'),'expected':enc.inverse_transform(m.predict(X)).tolist()}))
print('Selected',name,'holdout accuracy',winner['report']['accuracy'],'nested accuracy',summary['nested']['report']['accuracy'],flush=True)
