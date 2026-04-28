const express = require('express');
const router = express.Router();
const Busboy = require('busboy');
const Tab = require('../models/Tab');


/* --------------------------
CREATE TAB
-------------------------- */

router.post('/tabs',(req,res)=>{

console.log('UPLOAD STARTED');

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
let fileReceived=false;
let finished=false;



const saveTab=async()=>{

if(finished) return;
finished=true;

try{

if(!name || !type){
return res.status(400).json({
error:'Name and type required'
});
}

const tabData={
userId:'test-user',
name,
type,
status:'active'
};


if(fileReceived){

const fileBuffer=Buffer.concat(chunks);

console.log(
'Buffer size:',
fileBuffer.length
);

tabData.fileData=fileBuffer;

/* save uploaded mime */
tabData.mimeType=mimeType;

}


const newTab=new Tab(tabData);

await newTab.save();

res.status(201).json(newTab);

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
return res.status(413).json({
error:'File exceeds Mongo 16MB limit'
});
}

res.status(500).json({
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

fileReceived=true;

/* capture uploaded mime */
mimeType=info.mimeType || '';

console.log(
'Receiving file:',
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
return res.status(413).json({
error:'File too large'
});
}
);


file.on(
'end',
()=>{
console.log(
'File stream ended'
);
}
);


file.on(
'error',
(err)=>{
return res.status(500).json({
error:err.message
});
});

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

const tabs=await Tab.find({
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
GET FILE
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



/* smarter content type detection */

const fileName=
(tab.name || '').toLowerCase();

let contentType=
'application/octet-stream';


if(tab.type==='excel'){

contentType=
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

}

else if(
tab.type==='powerpoint'
){

contentType=
'application/vnd.openxmlformats-officedocument.presentationml.presentation';

}

else if(
tab.type==='docs'
){

if(
tab.mimeType==='application/pdf' ||
fileName.endsWith('.pdf')
){

contentType='application/pdf';

}

else{

contentType=
'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

}

}



res.set(
'Content-Type',
contentType
);

res.send(tab.fileData);

}

catch(err){

res.status(500).json({
error:err.message
});

}

});





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



if(
updates.googleSlideId!==undefined
){
tab.googleSlideId=
updates.googleSlideId;

tab.fileData=undefined;
}


if(
updates.googleSheetId!==undefined
){
tab.googleSheetId=
updates.googleSheetId;

tab.fileData=undefined;
}


if(
updates.content!==undefined
){
tab.content=
updates.content;

/* once edited,
stored as rich html */
tab.fileData=undefined;
}


if(updates.name){
tab.name=updates.name;
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