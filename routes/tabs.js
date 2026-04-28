const express = require('express');
const router = express.Router();
const Busboy = require('busboy');
const Tab = require('../models/Tab');

const libre = require('libreoffice-convert');
const util = require('util');

const convertAsync = util.promisify(
  libre.convert
);



/* --------------------------
CREATE TAB
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

const fileBuffer=
Buffer.concat(chunks);

/*
Store ORIGINAL file only
(no conversion here)
*/

tabData.fileData=
fileBuffer;

tabData.mimeType=
mimeType;

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

console.error(
'UPLOAD ERROR:',
err
);

if(
err.code===13113 ||
err.message.includes('16MB')
){
return safeReply(413,{
error:'File exceeds Mongo limit'
});
}

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

console.log(
'Receiving:',
info.filename,
mimeType
);


file.on(
'data',
(chunk)=>{
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


file.on(
'error',
(err)=>{
safeReply(500,{
error:err.message
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
GET ALL TABS
-------------------------- */

router.get('/tabs',async(req,res)=>{

const tabs=
await Tab.find({
userId:'test-user'
}).select('-fileData');

res.json(tabs);

});



/* --------------------------
GET SINGLE TAB
-------------------------- */

router.get('/tabs/:id',async(req,res)=>{

try{

const tab=
await Tab.findById(
req.params.id
);

if(!tab){
return res.status(404).json({
error:'No tab found'
});
}

res.json(tab);

}

catch(err){

res.status(500).json({
error:err.message
});

}

});



/* --------------------------
GET RAW FILE
-------------------------- */

router.get('/tabs/:id/file',async(req,res)=>{

try{

const tab=
await Tab.findById(
req.params.id
);

if(
!tab ||
!tab.fileData
){
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

else if(tab.type==='pdf'){
contentType=
'application/pdf';
}

else if(tab.type==='docs'){
contentType=
'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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
PDF -> DOCX CONVERSION
(used only for editing)
-------------------------- */

router.get(
'/tabs/:id/convert-pdf',
async(req,res)=>{

try{

const tab=
await Tab.findById(
req.params.id
);

if(!tab || !tab.fileData){
return res.status(404).json({
error:'PDF not found'
});
}


if(tab.type!=='pdf'){
return res.status(400).json({
error:'Tab is not PDF'
});
}


console.log(
'Converting PDF to DOCX...'
);

const docxBuffer=
await convertAsync(
tab.fileData,
'.docx',
undefined
);

res.set(
'Content-Type',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);

res.send(
docxBuffer
);

}

catch(err){

console.error(
'PDF conversion error:',
err
);

res.status(500).json({
error:err.message
});

}

}
);



/* --------------------------
PATCH
-------------------------- */

router.patch('/tabs/:id',async(req,res)=>{

const {updates}=req.body;

try{

const tab=
await Tab.findById(
req.params.id
);

if(!tab){
return res.status(404).json({
error:'Not found'
});
}


if(updates.content!==undefined){

tab.content=
updates.content;

/*
After editing save HTML
*/
tab.fileData=undefined;

}


if(updates.name){
tab.name=
updates.name;
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

try{

await Tab.findByIdAndDelete(
req.params.id
);

res.json({
message:'success'
});

}

catch(err){

res.status(500).json({
error:err.message
});

}

});


module.exports=router;