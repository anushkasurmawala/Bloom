export const arrays=['records','meds','appointments','questions','symptoms','wellness','movements','contractions','postpartumLogs','bag'];
export function blank(){return {profile:{},...Object.fromEntries(arrays.map(k=>[k,[]])),bag:['Medical notes and ID','Phone and charger','Comfortable clothes','Toiletries','Maternity pads','Baby clothes and nappies'].map((text,i)=>({id:'bag-'+i,text,done:false})),birthPlan:{},mode:'pregnancy',notificationEnabled:false};}
export function validateState(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid journal.');
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!object(value.profile??{})||!object(value.birthPlan??{}))throw Error('Invalid profile.');
 for(const k of arrays)if(value[k]!==undefined&&(!Array.isArray(value[k])||value[k].length>10000||value[k].some(x=>!object(x))))throw Error('Invalid journal records.');
 const allowed=new Set([...Object.keys(blank()),'activeContraction','birthDate']);
 if(Object.keys(value).some(k=>!allowed.has(k)))throw Error('Unknown journal fields.');
 return value;
}
