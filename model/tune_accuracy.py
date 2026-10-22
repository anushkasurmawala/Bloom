from pathlib import Path
import json
import numpy as np,pandas as pd
from sklearn.model_selection import StratifiedGroupKFold,RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler,LabelEncoder
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier,ExtraTreesClassifier,HistGradientBoostingClassifier
from sklearn.metrics import classification_report,confusion_matrix
from xgboost import XGBClassifier
root=Path(__file__).resolve().parents[1];df=pd.read_csv(root/'model/dataset.csv').drop_duplicates();features=list(df.columns[:-1]);X=df[features];enc=LabelEncoder();y=enc.fit_transform(df.RiskLevel);groups=X.astype(str).agg('|'.join,axis=1)
tr,te=next(StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=42).split(X,y,groups));folds=list(StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=7).split(X.iloc[tr],y[tr],groups.iloc[tr]));assert not set(groups.iloc[tr])&set(groups.iloc[te])
models={
 'Random forest':(RandomForestClassifier(n_estimators=300,random_state=42,n_jobs=1),{'max_depth':[3,4,5,6,8,12,None],'min_samples_leaf':[1,2,3,5],'max_features':['sqrt',None,0.8],'class_weight':[None,'balanced']}),
 'Extra trees':(ExtraTreesClassifier(n_estimators=300,random_state=42,n_jobs=1),{'max_depth':[3,4,6,8,12,None],'min_samples_leaf':[1,2,3,5],'max_features':['sqrt',None,0.8],'class_weight':[None,'balanced']}),
 'XGBoost':(XGBClassifier(objective='multi:softprob',num_class=3,eval_metric='mlogloss',random_state=42,n_jobs=1),{'n_estimators':[100,250,500],'max_depth':[1,2,3,4,6],'learning_rate':[0.01,0.03,0.1,0.2],'min_child_weight':[1,3,8],'reg_lambda':[1,5,15],'reg_alpha':[0,1,5],'subsample':[0.8,1],'colsample_bytree':[0.8,1]}),
 'RBF SVM':(Pipeline([('scale',StandardScaler()),('model',SVC())]),{'model__C':[0.1,1,3,10,30,100],'model__gamma':['scale',0.01,0.1,1],'model__class_weight':[None,'balanced']}),
 'K-nearest neighbors':(Pipeline([('scale',StandardScaler()),('model',KNeighborsClassifier())]),{'model__n_neighbors':[3,5,9,15,25,35],'model__weights':['uniform','distance'],'model__p':[1,2]}),
 'Histogram boosting':(HistGradientBoostingClassifier(random_state=42),{'max_iter':[100,250,400],'max_leaf_nodes':[5,10,20],'learning_rate':[0.03,0.1],'l2_regularization':[0,1,10],'min_samples_leaf':[5,10,20]})}
rows=[]
for name,(m,grid) in models.items():
 search=RandomizedSearchCV(m,grid,n_iter=18,random_state=2026,scoring={'accuracy':'accuracy','macro_f1':'f1_macro'},refit='accuracy',cv=folds,n_jobs=1).fit(X.iloc[tr],y[tr]);pred=search.predict(X.iloc[te]);r={'model':name,'best_parameters':search.best_params_,'training_cv_accuracy':float(search.best_score_),'training_cv_macro_f1':float(search.cv_results_['mean_test_macro_f1'][search.best_index_]),'test_report':classification_report(y[te],pred,labels=[0,1,2],target_names=enc.classes_,output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(y[te],pred).tolist()};rows.append(r);print(name,'CV',round(r['training_cv_accuracy'],3),'test',round(r['test_report']['accuracy'],3),flush=True)
# This run explicitly tests accuracy optimization, separately from the app's macro-F1 selection.
best=max(rows,key=lambda r:r['training_cv_accuracy']);maximum_agreement=X.groupby(features).size().size/len(X)
out={'goal_accuracy':0.97,'selection_metric':'Training grouped CV accuracy; holdout results exploratory because this set has been examined previously. Not nested or external validation. App model is not changed by this script.','models':rows,'selected_by_cv':best['model'],'selected_test_accuracy':best['test_report']['accuracy'],'unique_rows':len(df),'identical_input_groups':int(len(df.groupby(features))),'conflicting_input_groups':int((df.groupby(features).RiskLevel.nunique()>1).sum()),'maximum_exact_input_label_agreement_on_unique_records':float(maximum_agreement),'interpretation':'In the duplicate-free data, each (inputs,label) row occurs once. A deterministic function of only these six exact inputs can match at most one label per input group. This is a full-data label-consistency ceiling, not a test-set performance bound or clinical target.'}
(root/'model/accuracy-tuning.json').write_text(json.dumps(out,indent=2));print('RESULT',best['model'],best['test_report']['accuracy'],'ceiling',maximum_agreement,flush=True)
