from pathlib import Path
import json, zipfile
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedGroupKFold, cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import classification_report, confusion_matrix
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(root.parents[1]/'work/maternal.zip') as z:
    df=pd.read_csv(z.open(z.namelist()[0]))
df.to_csv(root/'model/dataset.csv',index=False)
features=list(df.columns[:-1]); original=len(df); df=df.drop_duplicates()
# Group equal input rows so contradictory labels cannot leak between splits.
groups=df[features].astype(str).agg('|'.join,axis=1)
splits=StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=42)
tr,te=next(splits.split(df[features],df.RiskLevel,groups))
X=df[features]; y=df.RiskLevel
scores={}
for depth in [3,4,5,6]:
    model=DecisionTreeClassifier(max_depth=depth,min_samples_leaf=5,class_weight='balanced',random_state=42)
    scores[depth]=float(cross_val_score(model,X.iloc[tr],y.iloc[tr],groups=groups.iloc[tr],cv=StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=7),scoring='f1_macro').mean())
best=max(scores,key=scores.get)
m=DecisionTreeClassifier(max_depth=best,min_samples_leaf=5,class_weight='balanced',random_state=42).fit(X.iloc[tr],y.iloc[tr])
pred=m.predict(X.iloc[te]); report=classification_report(y.iloc[te],pred,output_dict=True,zero_division=0)
b=DummyClassifier(strategy='most_frequent').fit(X.iloc[tr],y.iloc[tr])
metrics={'original_rows':original,'unique_rows':len(df),'train_rows':len(tr),'test_rows':len(te),'depth':best,'cv_macro_f1':scores,'report':report,'confusion_matrix':confusion_matrix(y.iloc[te],pred,labels=m.classes_).tolist(),'labels':m.classes_.tolist(),'baseline':classification_report(y.iloc[te],b.predict(X.iloc[te]),output_dict=True,zero_division=0),'method':'Exact-row deduplication, grouped input holdout; depth selected with grouped training cross-validation. Evaluation model is deployed unchanged.'}
t=m.tree_
export={'features':features,'classes':m.classes_.tolist(),'children_left':t.children_left.tolist(),'children_right':t.children_right.tolist(),'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'value':t.value[:,0,:].tolist(),'ranges':{f:[float(X.iloc[tr][f].min()),float(X.iloc[tr][f].max())] for f in features},'version':'uci-tree-1','metrics':metrics,'source':'https://archive.ics.uci.edu/dataset/863/maternal+health+risk'}
(root/'dist/model.json').write_text(json.dumps(export)); (root/'model/metrics.json').write_text(json.dumps(metrics,indent=2))
print(json.dumps({'macro_f1':report['macro avg']['f1-score'],'high_risk_recall':report['high risk']['recall'],'unique_rows':len(df)}))
