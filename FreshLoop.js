/* ===== 1. SAMPLE DATA =====
   The three starter posts. Real posts from the backend appear above these. */
var posts=[
 {org:"Cafe Ladera",av:"🥐",where:"0.4 mi away",addr:"Cafe Ladera, Santa Cruz, CA",title:"End-of-day pastries",desc:"Croissants and muffins, boxed in 6s. Ask at the back counter.",serv:30,hrs:1,tags:["Vegetarian"],warn:["Contains gluten","Contains dairy"],emoji:"🥐",g:"#F5D7A1,#E9A55B"},
 {org:"Oakes Dining Hall",av:"🍝",where:"0.7 mi away",addr:"Oakes College, Santa Cruz, CA",title:"Veggie pasta trays",desc:"Three full hotel pans, still hot. Bring your own containers if you can.",serv:40,hrs:3,tags:["Vegetarian"],warn:["Contains gluten"],emoji:"🍝",g:"#F7C6A8,#E4745A"},
 {org:"Harvest Market",av:"🥬",where:"1.1 mi away",addr:"Harvest Market, Santa Cruz, CA",title:"Produce box, slightly bruised",desc:"Tomatoes, kale and peppers. Fine to eat, not shelf-pretty.",serv:20,hrs:12,tags:["Vegetarian","Halal","Nut-free"],warn:[],emoji:"🍅",g:"#C9E7B5,#6FB56B"}
];

/* ===== 2. APP STATE ===== */
var API="http://localhost:8000";      // your FastAPI server (change when deployed)
var DEFAULT_ADDR="Santa Cruz, CA";    // Gemini can't know the pickup address, so this is filled in (editable)
var AUTO_POST=false;                  // true = post right after Gemini reads the photo (no review step)
var seed=posts.slice();               // the three samples, kept so they stay under the real posts
var filter="All";
var meals=1240;

/* ===== 3. HELPER FUNCTIONS ===== */
var $=function(i){return document.getElementById(i)};
function urg(h){return h<=1?"hot":h<=4?"warm":""}
function lbl(h){return h===1?"Expires within 1 hour":"Safe for "+h+" hours"}
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}

/* ===== 4. RENDER THE FEED ===== */
function render(){
  var list=posts.filter(function(p){return filter==="All"||p.tags.indexOf(filter)>-1});
  if(!list.length){$("feed").innerHTML='<div class="empty">No posts match this filter yet.<br>Be the first to post food.</div>';return}
  $("feed").innerHTML=list.map(function(p){
    var i=posts.indexOf(p),bg=p.img?'background-image:url('+p.img+')':'background:linear-gradient(135deg,'+p.g.split(",")[0]+','+p.g.split(",")[1]+')';
    return '<article class="'+(p.fresh?"new":"")+'" data-open="'+i+'" tabindex="0">'+
    '<div class="who"><div class="av">'+p.av+'</div><div><b>'+esc(p.org)+'</b><span>'+p.where+'</span></div></div>'+
    '<div class="photo" style="'+bg+'" role="img" aria-label="'+esc(p.title)+'">'+(p.img?"":p.emoji)+'<span class="badge '+urg(p.hrs)+'"><i></i>'+lbl(p.hrs)+'</span></div>'+
    '<div class="body"><h2>'+esc(p.title)+'</h2><p>'+esc(p.desc)+'</p>'+
    '<div class="tags">'+
    p.tags.map(function(t){return '<span class="tag">'+esc(t)+'</span>'}).join("")+p.warn.map(function(t){return '<span class="tag warn">'+esc(t)+'</span>'}).join("")+
    '</div><div class="row"><span class="meta">About '+p.serv+' servings</span><button class="claim" data-i="'+i+'"'+(p.claimed?" disabled":"")+'>'+(p.claimed?"Claimed":"Claim")+'</button></div></div></article>'}).join("");
}

/* ===== 5. FILTER CHIPS ===== */
function chips(){
  $("chips").innerHTML=["All","Vegetarian","Halal","Nut-free"].map(function(c){return '<button class="chip" aria-pressed="'+(c===filter)+'" data-c="'+c+'">'+c+'</button>'}).join("");
}
$("chips").onclick=function(e){var c=e.target.getAttribute("data-c");if(c){filter=c;chips();render()}};

/* ===== 6. CLAIM + DETAIL VIEW ===== */
function claim(i){var p=posts[i];if(p.claimed)return;p.claimed=true;meals+=p.serv;$("meals").textContent=meals.toLocaleString();render();if($("detail").open)openDetail(i);toast("Claimed. The donor has been notified.");
  // tell the server (sample posts have no id, so they are skipped)
  if(p.id){fetch(API+"/listings/"+p.id+"/claim?receiver_name=You",{method:"POST"}).catch(function(){})}}
function safeUntil(h){return new Date(Date.now()+h*3600000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
function openDetail(i){
  var p=posts[i],bg=p.img?'background-image:url('+p.img+')':'background:linear-gradient(135deg,'+p.g.split(",")[0]+','+p.g.split(",")[1]+')';
  var map=p.addr?'<iframe class="map" title="Map of the pickup location" loading="lazy" src="https://maps.google.com/maps?q='+encodeURIComponent(p.addr)+'&z=15&output=embed"></iframe><div class="addr"><span>'+esc(p.addr)+'</span><a class="dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(p.addr)+'">Get directions</a></div>':'<div class="nomap">No pickup address was added to this post.</div>';
  $("detailBody").innerHTML=
    '<div class="photo big" style="'+bg+'" role="img" aria-label="'+esc(p.title)+'">'+(p.img?"":p.emoji)+'<span class="badge '+urg(p.hrs)+'"><i></i>'+lbl(p.hrs)+'</span></div>'+
    '<div class="dbody">'+
    '<div class="who flush"><div class="av">'+p.av+'</div><div><b>'+esc(p.org)+'</b><span>'+esc(p.where)+'</span></div></div>'+
    '<h2>'+esc(p.title)+'</h2><p class="desc">'+esc(p.desc)+'</p>'+
    '<div class="facts"><div><b>'+p.serv+'</b><span>servings</span></div><div><b>'+p.until+'</b><span>safe until</span></div></div>'+
    '<div class="tags">'+p.tags.map(function(t){return '<span class="tag">'+esc(t)+'</span>'}).join("")+p.warn.map(function(t){return '<span class="tag warn">'+esc(t)+'</span>'}).join("")+'</div>'+
    map+
    '<button class="claim wide" data-d="'+i+'"'+(p.claimed?" disabled":"")+'>'+(p.claimed?"Claimed":"Claim this food")+'</button></div>';
  $("detail").showModal();
}
$("feed").onclick=function(e){var i=e.target.getAttribute("data-i");if(i!==null){claim(i);return}var a=e.target.closest("article");if(a)openDetail(a.getAttribute("data-open"))};
$("feed").onkeydown=function(e){if(e.key==="Enter"&&e.target.tagName==="ARTICLE")openDetail(e.target.getAttribute("data-open"))};
$("dclose").onclick=function(){$("detail").close()};
$("detail").onclick=function(e){if(e.target===this){this.close();return}var d=e.target.getAttribute("data-d");if(d!==null)claim(d)};

/* ===== 7. TOAST ===== */
function toast(m){var t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},2200)}

/* ===== 8. POST FORM: PHOTO IN, GEMINI FILLS EVERYTHING ===== */
var photo=null;   // the chosen photo (shrunken) as a data URL
var ai=null;      // Gemini's analysis of the current photo

// Opening the form: Post stays greyed out until a photo has been analyzed
$("open").onclick=function(){$("f").reset();photo=null;ai=null;$("submit").disabled=true;$("drop").className="drop";$("drop").style.backgroundImage="";$("dropText").textContent="Tap to add a photo of the food";$("dlg").showModal()};
$("cancel").onclick=function(){$("dlg").close()};
$("drop").onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();$("file").click()}};

// Shrinks the photo to max 1024px (fast upload, small storage); returns a data URL and a Blob
function shrink(file,cb){
  var r=new FileReader();
  r.onload=function(){
    var im=new Image();
    im.onload=function(){
      var s=Math.min(1,1024/Math.max(im.width,im.height));
      var c=document.createElement("canvas");
      c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      c.toBlob(function(blob){cb(c.toDataURL("image/jpeg",0.8),blob)},"image/jpeg",0.8)};
    im.src=r.result};
  r.readAsDataURL(file)}

// Picks the "Safe for" option closest to Gemini's hours (options are 1, 3, 6, 12)
function setHours(h){
  var el=$("hrs"),best=null,diff=1e9;
  for(var i=0;i<el.options.length;i++){var d=Math.abs(parseFloat(el.options[i].value)-h);if(d<diff){diff=d;best=el.options[i].value}}
  if(best!==null)el.value=best}

// Picks the dietary dropdown option that matches Gemini's tags
function setDiet(tags){
  var t=(tags||[]).map(function(x){return x.toLowerCase()});
  var pick="";
  if(t.indexOf("halal")>-1)pick="Halal";
  else if(t.indexOf("nut-free")>-1)pick="Nut-free";
  else if(t.indexOf("vegetarian")>-1||t.indexOf("vegan")>-1)pick="Vegetarian";
  $("diet").value=pick}

// Sends the photo to the backend and fills in the whole form with what Gemini found
function autofill(blob){
  $("dropText").textContent="Reading your photo with Gemini...";
  $("submit").disabled=true;
  var fd=new FormData();fd.append("file",blob,"photo.jpg");
  fetch(API+"/analyze",{method:"POST",body:fd})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(a){
      ai=a;
      $("title").value=(a.title||"Surplus food").slice(0,60);
      $("desc").value=(a.description||"").slice(0,160);
      $("serv").value=Math.max(1,a.est_servings||1);
      setHours(a.safe_hours);
      setDiet(a.dietary_tags);
      if(!$("addr").value)$("addr").value=DEFAULT_ADDR;
      $("dropText").textContent="Photo added";
      if(AUTO_POST&&!a.needs_human_check){$("f").requestSubmit();return}
      toast(a.needs_human_check?"Please double-check these details.":"All filled in. Edit anything, then post.")})
    .catch(function(err){
      console.error("analyze failed:",err);
      $("title").value="Surplus food";
      if(!$("addr").value)$("addr").value=DEFAULT_ADDR;
      $("dropText").textContent="Photo added";
      toast("Gemini failed ("+err.message+"). Fill in the details.")})
    .then(function(){$("submit").disabled=false})}   // runs whether it worked or not

// When a photo is chosen: shrink it, show the preview, then autofill the form
$("file").onchange=function(){var f=this.files[0];if(!f)return;
  shrink(f,function(dataUrl,blob){
    photo=dataUrl;
    $("drop").className="drop has";
    $("drop").style.backgroundImage="url("+photo+")";
    autofill(blob)});
  this.value=""};   // lets you pick the same photo again

/* ===== 9. POST FORM: SUBMIT ===== */
// Turns Gemini's lowercase tags into chip names ("vegan" also counts as Vegetarian)
function cap(list){var out=[];list.forEach(function(t){
  var c=t.charAt(0).toUpperCase()+t.slice(1);
  if(out.indexOf(c)<0)out.push(c);
  if(c==="Vegan"&&out.indexOf("Vegetarian")<0)out.push("Vegetarian")});return out}

$("f").onsubmit=function(){
  var h=parseInt($("hrs").value,10),d=$("diet").value;
  var tags=ai?cap(ai.dietary_tags||[]):[];
  if(d&&tags.indexOf(d)<0)tags.push(d);
  var warn=ai?(ai.allergens||[]).map(function(a){return "Contains "+a}):[];
  var post={org:"You",av:"🙋",where:"Just posted",addr:$("addr").value.trim(),until:safeUntil(h),title:$("title").value.trim(),desc:$("desc").value.trim()||"Pickup details to be confirmed.",serv:parseInt($("serv").value,10)||1,hrs:h,tags:tags,warn:warn,emoji:"🍽️",g:"#E8DFC0,#C7B77A",img:photo};
  // save to the backend; if it's down, still show the post on this page
  fetch(API+"/listings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(post)})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .catch(function(){toast("Server unreachable. Saved on this page only.");return post})
    .then(function(saved){
      saved=norm(saved);saved.fresh=true;
      posts.unshift(saved);
      filter="All";chips();render();
      window.scrollTo({top:0,behavior:"smooth"});
      toast("Posted. Nearby receivers will be alerted.")})};

/* ===== 10. LOAD POSTS FROM THE BACKEND ===== */
function ago(t){var m=Math.round((Date.now()-new Date(t).getTime())/60000);return m<1?"Just posted":m<60?m+" min ago":Math.round(m/60)+" hr ago"}
// Fills in anything a saved post is missing so the cards and detail view never break
function norm(p){
  p.org=p.org||"Donor";p.av=p.av||"🙋";p.emoji=p.emoji||"🍽️";p.g=p.g||"#E8DFC0,#C7B77A";
  p.tags=p.tags||[];p.warn=p.warn||[];p.hrs=p.hrs||3;p.serv=p.serv||1;
  p.claimed=p.claimed||p.status==="claimed";
  if(p.created_at){
    p.where=ago(p.created_at);
    p.until=new Date(new Date(p.created_at).getTime()+p.hrs*3600000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
  else{p.where=p.where||"Just posted";p.until=p.until||safeUntil(p.hrs)}
  return p}

var lastKey="";
function load(){
  if($("detail").open||$("dlg").open)return;   // don't shuffle cards while someone is using a pop-up
  fetch(API+"/listings").then(function(r){return r.json()})
    .then(function(list){
      list=list.filter(function(r){return r.title}).map(norm).reverse();   // skips old test entries without a title
      var key=list.map(function(p){return p.id+p.status}).join();
      if(key===lastKey)return;lastKey=key;
      var local=posts.filter(function(p){return !p.id&&seed.indexOf(p)<0});   // posts made while the server was down
      posts=local.concat(list,seed);
      render()})
    .catch(function(){})}

/* ===== 11. START ===== */
seed.forEach(function(p){p.until=safeUntil(p.hrs)});
chips();render();
load();
setInterval(load,8000);   // other devices see new posts within 8 seconds