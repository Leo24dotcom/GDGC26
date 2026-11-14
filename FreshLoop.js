/* ===== 1. SAMPLE DATA =====
   The three starter posts. Each post has:
   org = donor name | av = avatar emoji | where = distance text | title / desc = headline and details
   serv = servings | hrs = hours the food is safe | tags = dietary tags | warn = allergen tags
   emoji = emoji shown as the "photo" | g = two gradient colors behind the emoji
   When you connect Firebase, this array is what you replace with data from Firestore. */
var posts=[
 {org:"Cafe Ladera",av:"🥐",where:"0.4 mi away",title:"End-of-day pastries",desc:"Croissants and muffins, boxed in 6s. Ask at the back counter.",serv:30,hrs:1,tags:["Vegetarian"],warn:["Contains gluten","Contains dairy"],emoji:"🥐",g:"#F5D7A1,#E9A55B"},
 {org:"Oakes Dining Hall",av:"🍝",where:"0.7 mi away",title:"Veggie pasta trays",desc:"Three full hotel pans, still hot. Bring your own containers if you can.",serv:40,hrs:3,tags:["Vegetarian"],warn:["Contains gluten"],emoji:"🍝",g:"#F7C6A8,#E4745A"},
 {org:"Harvest Market",av:"🥬",where:"1.1 mi away",title:"Produce box, slightly bruised",desc:"Tomatoes, kale and peppers. Fine to eat, not shelf-pretty.",serv:20,hrs:12,tags:["Vegetarian","Halal","Nut-free"],warn:[],emoji:"🍅",g:"#C9E7B5,#6FB56B"}
];

/* ===== 2. APP STATE (values that change while the app runs) ===== */
var filter="All";     // which filter chip is selected
var claimed={};       // which posts have been claimed, e.g. {0:true}
var meals=1240;       // the "meals rescued" counter in the header
var customs=0;        // not used anywhere; safe to delete

/* ===== 3. HELPER FUNCTIONS ===== */
// Shortcut: $("feed") is the same as document.getElementById("feed")
var $=function(i){return document.getElementById(i)};
// Picks the badge color: 1 hour or less = red, up to 4 hours = amber, otherwise green
function urg(h){return h<=1?"hot":h<=4?"warm":""}
// Builds the badge text: "Expires within 1 hour" or "Safe for 3 hours"
function lbl(h){return h===1?"Expires within 1 hour":"Safe for "+h+" hours"}
// Makes user-typed text safe to put in the page (stops people injecting HTML)
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}

/* ===== 4. RENDER THE FEED =====
   Rebuilds all the cards from the posts array. Runs on page load,
   after a filter click, after a claim, and after a new post. */
function render(){
  // Keep only the posts that match the selected filter chip
  var list=posts.filter(function(p){return filter==="All"||p.tags.indexOf(filter)>-1});
  // If nothing matches, show the empty message and stop
  if(!list.length){$("feed").innerHTML='<div class="empty">No posts match this filter yet.<br>Be the first to post food.</div>';return}
  // Otherwise build one card (<article>) per post
  $("feed").innerHTML=list.map(function(p){
    // i = the post's position in the array; bg = uploaded photo if there is one, else the gradient
    var i=posts.indexOf(p),bg=p.img?'background-image:url('+p.img+')':'background:linear-gradient(135deg,'+p.g.split(",")[0]+','+p.g.split(",")[1]+')';
    return '<article class="'+(p.fresh?"new":"")+'">'+
    // Top row: avatar, donor name, distance
    '<div class="who"><div class="av">'+p.av+'</div><div><b>'+esc(p.org)+'</b><span>'+p.where+'</span></div></div>'+
    // Photo area with the urgency badge on top
    '<div class="photo" style="'+bg+'" role="img" aria-label="'+esc(p.title)+'">'+(p.img?"":p.emoji)+'<span class="badge '+urg(p.hrs)+'"><i></i>'+lbl(p.hrs)+'</span></div>'+
    // Text area: title and description
    '<div class="body"><h2>'+esc(p.title)+'</h2><p>'+esc(p.desc)+'</p>'+
    // Tag row: dietary tags, then allergen warnings
    '<div class="tags">'+
    p.tags.map(function(t){return '<span class="tag">'+esc(t)+'</span>'}).join("")+p.warn.map(function(t){return '<span class="tag warn">'+esc(t)+'</span>'}).join("")+
    // Bottom row: servings and the Claim button (greyed out and relabeled once claimed)
    '</div><div class="row"><span class="meta">About '+p.serv+' servings</span><button class="claim" data-i="'+i+'"'+(claimed[i]?" disabled":"")+'>'+(claimed[i]?"Claimed":"Claim")+'</button></div></div></article>'}).join("");
}

/* ===== 5. FILTER CHIPS ===== */
// Draws the four chips; the one matching `filter` is marked selected
function chips(){
  $("chips").innerHTML=["All","Vegetarian","Halal","Nut-free"].map(function(c){return '<button class="chip" aria-pressed="'+(c===filter)+'" data-c="'+c+'">'+c+'</button>'}).join("");
}
// When a chip is clicked: save the choice, redraw the chips, redraw the feed
$("chips").onclick=function(e){var c=e.target.getAttribute("data-c");if(c){filter=c;chips();render()}};

/* ===== 6. CLAIM BUTTON =====
   One click listener on the whole feed; it only acts if the click was on a Claim button (data-i). */
$("feed").onclick=function(e){var i=e.target.getAttribute("data-i");if(i===null)return;
  claimed[i]=true;                                   // mark the post as claimed
  meals+=posts[i].serv;                              // add its servings to the counter
  $("meals").textContent=meals.toLocaleString();     // update the header number (adds commas)
  render();                                          // redraw so the button shows "Claimed"
  toast("Claimed. The donor has been notified.")};

/* ===== 7. TOAST (small message that disappears after 2.2 seconds) ===== */
function toast(m){var t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},2200)}

/* ===== 8. POST FORM: OPEN, CANCEL, PHOTO UPLOAD ===== */
var photo=null;   // holds the chosen photo as a data URL until the form is submitted
// "+ Post food" button: clear the form, reset the photo box, open the pop-up
$("open").onclick=function(){$("f").reset();photo=null;$("drop").className="drop";$("drop").style.backgroundImage="";$("dropText").textContent="Tap to add a photo of the food";$("dlg").showModal()};
// Cancel button closes the pop-up
$("cancel").onclick=function(){$("dlg").close()};
// Lets keyboard users press Enter or Space on the photo box to open the file picker
$("drop").onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();$("file").click()}};
// When a photo is chosen: read it, then show it as the preview inside the upload box
$("file").onchange=function(){var f=this.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){photo=r.result;$("drop").className="drop has";$("drop").style.backgroundImage="url("+photo+")"};r.readAsDataURL(f)};

/* ===== 9. POST FORM: SUBMIT =====
   Builds a new post from the form fields and puts it at the top of the feed. */
$("f").onsubmit=function(){
  var h=parseInt($("hrs").value,10),d=$("diet").value;   // h = hours safe, d = chosen dietary tag
  posts.unshift({org:"You",av:"🙋",where:"Just posted",title:$("title").value.trim(),desc:$("desc").value.trim()||"Pickup details to be confirmed.",serv:parseInt($("serv").value,10)||1,hrs:h,tags:d?[d]:[],warn:[],emoji:"🍽️",g:"#E8DFC0,#C7B77A",img:photo,fresh:true});
  filter="All";chips();render();                         // reset the filter and redraw
  window.scrollTo({top:0,behavior:"smooth"});            // scroll up to the new post
  toast("Posted. Nearby receivers will be alerted.")};

/* ===== 10. START =====
   Draw the chips and the feed when the page first loads. */
chips();render();