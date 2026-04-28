const express = require('express');
const router = express.Router();
const Busboy = require('busboy');
const axios = require('axios');
const FormData = require('form-data');
const Tab = require('../models/Tab');


/* --------------------------
CREATE TAB (UPLOAD)
-------------------------- */

router.post('/tabs',(req,res)=>{

let responded=false;

const safeReply=(code,data)=>{
if(responded) return;
responded=true;
return res.status(code).json(data);
};

const busboy=Busboy({
headers:req.headers,
limits:{
fileSize:15*1024*1024,
files:1
}
});

let name='';
let type='';
let mimeType='';
let chunks=[];


const saveTab=async()=>{

try{

if(!name || !type){
return safeReply(400,{
error:'Name and type required'
});
}

const tabData={
userId:'test-user',
name,
type,
status:'active'
};


if(chunks.length){

const fileBuffer=Buffer.concat(chunks);


/* -----------------------------
PDF -> CloudConvert to DOCX
----------------------------- */

if(type==='pdf'){

try{

console.log('Uploading PDF to CloudConvert...');

const job=await axios.post(
'https://api.cloudconvert.com/v2/jobs',
{
tasks:{
'import-file':{
operation:'import/upload'
},
'convert-file':{
operation:'convert',
input:'import-file',
input_format:'pdf',
output_format:'docx'
},
'export-file':{
operation:'export/url',
input:'convert-file'
}
}
},
{
headers:{
Authorization:
`Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
'Content-Type':'application/json'
}
}
);


const importTask=
job.data.data.tasks.find(
t=>t.name==='import-file'
);


const uploadForm=
new FormData();

Object.entries(
importTask.result.form.parameters
).forEach(([k,v])=>{
uploadForm.append(k,v);
});

uploadForm.append(
'file',
fileBuffer,
name
);

await axios.post(
importTask.result.form.url,
uploadForm,
{
headers:uploadForm.getHeaders()
}
);


let finishedJob;

for(let i=0;i<20;i++){

await new Promise(r=>
setTimeout(r,3000)
);

const poll=
await axios.get(
`https://api.cloudconvert.com/v2/jobs/${job.data.data.id}`,
{
headers:{
Authorization:
`Bearer ${process.env.CLOUDCONVERT_API_KEY}`
}
}
);

finishedJob=poll.data.data;

if(
finishedJob.status==='finished'
){
break;
}

}


const exportTask=
finishedJob.tasks.find(
t=>t.name==='export-file'
);

const downloadUrl=
exportTask.result.files[0].url;


const converted=
await axios.get(
downloadUrl,
{
responseType:'arraybuffer'
}
);


tabData.fileData=
Buffer.from(
converted.data
);

tabData.type='docs';

tabData.mimeType=
'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

console.log(
'PDF converted successfully'
);

}

catch(err){

console.error(
'CloudConvert failed:',
err.response?.data || err.message
);

tabData.fileData=fileBuffer;
tabData.type='pdf';
tabData.mimeType='application/pdf';

}

}

else{

tabData.fileData=fileBuffer;
tabData.mimeType=mimeType;

}

}



const newTab=
new Tab(tabData);

await newTab.save();

safeReply(
201,
newTab
);

}

catch(err){

console.error(err);

safeReply(500,{
error:err.message
});

}

};


busboy.on(
'field',
(field,val)=>{

if(field==='name'){
name=val;
}

if(field==='type'){
type=val;
}

}
);


busboy.on(
'file',
(field,file,info)=>{

mimeType=
info.mimeType || '';

file.on(
'data',
chunk=>{
chunks.push(
Buffer.from(chunk)
);
}
);

file.on(
'limit',
()=>{
safeReply(413,{
error:'File too large'
});
}
);

}
);


busboy.on(
'finish',
saveTab
);

req.pipe(busboy);

});




/* --------------------------
NEW BLANK TEMPLATES
-------------------------- */

router.post(
'/tabs/blank',
async(req,res)=>{

try{

const {
name,
type,
template
}=req.body;


let starterContent='';


if(template==='Blank Document'){
starterContent=
'<h1>Untitled Document</h1><p>Start typing...</p>';
}

else if(template==='Meeting Notes'){
starterContent=
'<h1>Meeting Notes</h1><ul><li>Agenda</li><li>Discussion</li><li>Action Items</li></ul>';
}

else if(template==='Project Report'){
starterContent=
'<h1>Project Report</h1><h2>Introduction</h2><p></p>';
}

else if(template==='Blank Spreadsheet'){
starterContent=
JSON.stringify([
['','',''],
['','',''],
['','','']
]);
}

else if(template==='Budget Sheet'){
starterContent=
JSON.stringify([
['Item','Amount'],
['Rent',''],
['Utilities','']
]);
}

else if(template==='Blank Presentation'){
starterContent=
JSON.stringify([
{
title:'New Presentation',
content:''
}
]);
}

else if(template==='Pitch Deck'){
starterContent=
JSON.stringify([
{
title:'Problem Statement',
content:''
}
]);
}


const tab=
new Tab({
userId:'test-user',
name,
type,
status:'active',
content:starterContent
});

await tab.save();

res.status(201).json(tab);

}

catch(err){

res.status(500).json({
error:err.message
});

}

}
);




/* --------------------------
GET ALL
-------------------------- */

router.get('/tabs',async(req,res)=>{

const tabs=
await Tab.find({
userId:'test-user'
}).select('-fileData');

res.json(tabs);

});



/* --------------------------
GET SINGLE
-------------------------- */

router.get('/tabs/:id',async(req,res)=>{

try{

const tab=
await Tab.findById(
req.params.id
);

res.json(tab);

}
catch(err){

res.status(500).json({
error:err.message
});

}

});



/* --------------------------
GET FILE
-------------------------- */

router.get('/tabs/:id/file',async(req,res)=>{

try{

const tab=
await Tab.findById(
req.params.id
);

if(!tab?.fileData){
return res.status(404).json({
error:'No file found'
});
}

let contentType=
'application/octet-stream';


if(tab.type==='excel'){
contentType=
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

else if(tab.type==='powerpoint'){
contentType=
'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

else if(tab.type==='docs'){
contentType=
'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

else if(tab.type==='pdf'){
contentType=
'application/pdf';
}


res.set(
'Content-Disposition',
'inline'
);

res.set(
'Content-Type',
contentType
);

res.send(
tab.fileData
);

}

catch(err){

res.status(500).json({
error:err.message
});

}

});



/* --------------------------
PATCH  (FIXED)
-------------------------- */

router.patch('/tabs/:id',async(req,res)=>{

const {updates}=req.body;

try{

const tab=
await Tab.findById(
req.params.id
);


/*
ONLY docs editor clears binary
DO NOT wipe uploaded ppt/xlsx/pdf
*/

if(updates.content!==undefined){

tab.content=
updates.content;

if(tab.type==='docs'){
tab.fileData=undefined;
}

}


if(updates.name){
tab.name=
updates.name;
}


if(
updates.googleSlideId!==undefined
){
tab.googleSlideId=
updates.googleSlideId;
}


await tab.save();

res.json(tab);

}

catch(err){

res.status(500).json({
error:err.message
});

}

});



/* --------------------------
DELETE
-------------------------- */

router.delete('/tabs/:id',async(req,res)=>{

await Tab.findByIdAndDelete(
req.params.id
);

res.json({
message:'success'
});

});


module.exports=router;