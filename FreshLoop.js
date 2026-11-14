/* ===== 1. APP STATE ===== */
var posts = [];       // populated by GET /listings
var filter = "All";   // which filter chip is selected
var meals = 1240;     // meals rescued counter

/* ===== 2. HELPER FUNCTIONS ===== */
var $ = function(i) { return document.getElementById(i); };

// Badge color: 1 hour or less = red, up to 4 hours = amber, otherwise green
function urg(h) { return h <= 1 ? "hot" : h <= 4 ? "warm" : ""; }

// Badge text: "Expires within 1 hour" or "Safe for 3 hours"
function lbl(h) { return h === 1 ? "Expires within 1 hour" : "Safe for " + h + " hours"; }

// Escape HTML for template strings
function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

// Clock time when food stops being safe
function safeUntil(h) { return new Date(Date.now() + h * 3600000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

// Small message popup
function toast(m) {
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 2200);
}

/* ===== 3. RENDER THE FEED =====
   Builds cards from posts array using textContent for text fields. */
function render() {
  var feed = $("feed");
  feed.innerHTML = "";

  var list = posts.filter(function(p) {
    var tags = p.dietary_tags || p.tags || [];
    return filter === "All" || tags.indexOf(filter) > -1;
  });

  if (!list.length) {
    var emptyDiv = document.createElement("div");
    emptyDiv.className = "empty";
    emptyDiv.textContent = "No posts match this filter yet. Be the first to post food.";
    feed.appendChild(emptyDiv);
    return;
  }

  list.forEach(function(p) {
    var i = posts.indexOf(p);
    var article = document.createElement("article");
    if (p.fresh) article.className = "new";
    article.setAttribute("data-open", i);
    article.tabIndex = 0;

    var titleVal = p.title || (p.items && p.items[0] && p.items[0].name) || "Surplus Food";
    var servVal = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : p.serv);
    var addrVal = p.pickupAddress !== undefined && p.pickupAddress !== null ? p.pickupAddress : (p.pickup_address !== undefined && p.pickup_address !== null ? p.pickup_address : p.addr);
    var orgVal = p.donor_name || p.org || "Community Donor";
    var whereVal = p.where || (p.lat && p.lng ? p.lat.toFixed(2) + ", " + p.lng.toFixed(2) : "");
    var descVal = p.desc || p.storage_notes || "";
    var hrs = p.safe_hours || p.hrs || 3;

    // Top row: avatar, donor name, distance
    var who = document.createElement("div");
    who.className = "who";

    var av = document.createElement("div");
    av.className = "av";
    av.textContent = p.av || "🥐";
    who.appendChild(av);

    var whoText = document.createElement("div");
    var bOrg = document.createElement("b");
    bOrg.textContent = orgVal;
    whoText.appendChild(bOrg);

    if (whereVal) {
      var spanWhere = document.createElement("span");
      spanWhere.textContent = whereVal;
      whoText.appendChild(spanWhere);
    }
    who.appendChild(whoText);
    article.appendChild(who);

    // Photo area with urgency badge
    var photoDiv = document.createElement("div");
    photoDiv.className = "photo";
    if (p.img) {
      photoDiv.style.backgroundImage = "url(" + p.img + ")";
    } else {
      var g = p.g || "#F5D7A1,#E9A55B";
      var parts = g.split(",");
      photoDiv.style.background = "linear-gradient(135deg," + parts[0] + "," + (parts[1] || parts[0]) + ")";
      var photoEmoji = document.createElement("span");
      photoEmoji.textContent = p.emoji || "🥐";
      photoDiv.appendChild(photoEmoji);
    }
    photoDiv.setAttribute("role", "img");
    photoDiv.setAttribute("aria-label", titleVal);

    var badge = document.createElement("span");
    badge.className = "badge " + urg(hrs);
    var badgeDot = document.createElement("i");
    badge.appendChild(badgeDot);
    var badgeText = document.createTextNode(lbl(hrs));
    badge.appendChild(badgeText);
    photoDiv.appendChild(badge);

    article.appendChild(photoDiv);

    // Body area
    var bodyDiv = document.createElement("div");
    bodyDiv.className = "body";

    // Title (rendered via textContent)
    var h2 = document.createElement("h2");
    h2.textContent = titleVal;
    bodyDiv.appendChild(h2);

    // Description (if present)
    if (descVal) {
      var pDesc = document.createElement("p");
      pDesc.textContent = descVal;
      bodyDiv.appendChild(pDesc);
    }

    // pickupAddress (shown when present via textContent)
    if (addrVal) {
      var addrDiv = document.createElement("div");
      addrDiv.className = "addr";
      addrDiv.textContent = addrVal;
      bodyDiv.appendChild(addrDiv);
    }

    // Dietary tags and allergen warnings
    var tags = p.dietary_tags || p.tags || [];
    var warn = p.allergens || p.warn || [];
    if (tags.length || warn.length) {
      var tagsDiv = document.createElement("div");
      tagsDiv.className = "tags";
      tags.forEach(function(t) {
        var tagSpan = document.createElement("span");
        tagSpan.className = "tag";
        tagSpan.textContent = t;
        tagsDiv.appendChild(tagSpan);
      });
      warn.forEach(function(w) {
        var warnSpan = document.createElement("span");
        warnSpan.className = "tag warn";
        warnSpan.textContent = w;
        tagsDiv.appendChild(warnSpan);
      });
      bodyDiv.appendChild(tagsDiv);
    }

    // Row: servings + Claim button
    var rowDiv = document.createElement("div");
    rowDiv.className = "row";

    // Servings (shown when present via textContent)
    if (servVal !== undefined && servVal !== null && servVal !== "") {
      var metaSpan = document.createElement("span");
      metaSpan.className = "meta";
      var strServ = String(servVal);
      metaSpan.textContent = /^\d+$/.test(strServ.trim()) ? "About " + strServ.trim() + " servings" : strServ;
      rowDiv.appendChild(metaSpan);
    }

    var claimBtn = document.createElement("button");
    claimBtn.className = "claim";
    claimBtn.setAttribute("data-i", i);
    if (p.claimed) {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claimed";
    } else {
      claimBtn.textContent = "Claim";
    }
    rowDiv.appendChild(claimBtn);

    bodyDiv.appendChild(rowDiv);
    article.appendChild(bodyDiv);

    feed.appendChild(article);
  });
}

/* ===== 4. FILTER CHIPS ===== */
function chips() {
  $("chips").innerHTML = ["All", "Vegetarian", "Halal", "Nut-free"].map(function(c) {
    return '<button class="chip" aria-pressed="' + (c === filter) + '" data-c="' + c + '">' + c + '</button>';
  }).join("");
}

$("chips").onclick = function(e) {
  var c = e.target.getAttribute("data-c");
  if (c) {
    filter = c;
    chips();
    render();
  }
};

/* ===== 5. CLAIM + DETAIL VIEW ===== */
function claim(i) {
  var p = posts[i];
  if (!p || p.claimed) return;
  p.claimed = true;
  var serv = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : (p.serv || 0));
  meals += (parseInt(serv, 10) || 0);
  $("meals").textContent = meals.toLocaleString();
  render();
  if ($("detail").open) openDetail(i);
  if (p.id) {
    fetch("/listings/" + encodeURIComponent(p.id) + "/claim?receiver_name=Neighbor", { method: "POST" }).catch(function(e) {
      console.error(e);
    });
  }
  toast("Claimed. The donor has been notified.");
}

function openDetail(i) {
  var p = posts[i];
  if (!p) return;

  var title = p.title || (p.items && p.items[0] && p.items[0].name) || "Surplus Food";
  var desc = p.desc || p.storage_notes || "";
  var addr = p.pickupAddress !== undefined && p.pickupAddress !== null ? p.pickupAddress : (p.pickup_address !== undefined && p.pickup_address !== null ? p.pickup_address : p.addr);
  var serv = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : (p.serv || 0));
  var hrs = p.safe_hours || p.hrs || 3;
  var until = p.until || safeUntil(hrs);
  var org = p.donor_name || p.org || "Community Donor";
  var where = p.where || (p.lat && p.lng ? p.lat.toFixed(2) + ", " + p.lng.toFixed(2) : "");
  var tags = p.dietary_tags || p.tags || [];
  var warn = p.allergens || p.warn || [];

  var gParts = (p.g || "#F5D7A1,#E9A55B").split(",");
  var bg = p.img ? 'background-image:url(' + p.img + ')' : 'background:linear-gradient(135deg,' + gParts[0] + ',' + (gParts[1] || gParts[0]) + ')';

  var map = addr ? '<iframe class="map" title="Map of the pickup location" loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(addr) + '&z=15&output=embed"></iframe><div class="addr"><span>' + esc(addr) + '</span><a class="dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) + '">Get directions</a></div>' : '<div class="nomap">No pickup address was added to this post.</div>';

  $("detailBody").innerHTML =
    '<div class="photo big" style="' + bg + '" role="img" aria-label="' + esc(title) + '">' + (p.img ? "" : (p.emoji || "🥐")) + '<span class="badge ' + urg(hrs) + '"><i></i>' + lbl(hrs) + '</span></div>' +
    '<div class="dbody">' +
    '<div class="who flush"><div class="av">' + (p.av || "🥐") + '</div><div><b>' + esc(org) + '</b><span>' + esc(where) + '</span></div></div>' +
    '<h2>' + esc(title) + '</h2><p class="desc">' + esc(desc) + '</p>' +
    '<div class="facts"><div><b>' + serv + '</b><span>servings</span></div><div><b>' + until + '</b><span>safe until</span></div></div>' +
    '<div class="tags">' + tags.map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + warn.map(function(t) { return '<span class="tag warn">' + esc(t) + '</span>'; }).join("") + '</div>' +
    map +
    '<button class="claim wide" data-d="' + i + '"' + (p.claimed ? " disabled" : "") + '>' + (p.claimed ? "Claimed" : "Claim this food") + '</button></div>';

  $("detail").showModal();
}

// Click and keydown handlers for feed
$("feed").onclick = function(e) {
  var i = e.target.getAttribute("data-i");
  if (i !== null) {
    claim(i);
    return;
  }
  var a = e.target.closest("article");
  if (a) openDetail(a.getAttribute("data-open"));
};

$("feed").onkeydown = function(e) {
  if (e.key === "Enter" && e.target.tagName === "ARTICLE") {
    openDetail(e.target.getAttribute("data-open"));
  }
};

$("dclose").onclick = function() { $("detail").close(); };
$("detail").onclick = function(e) {
  if (e.target === this) { this.close(); return; }
  var d = e.target.getAttribute("data-d");
  if (d !== null) claim(d);
};

/* ===== 6. POST FORM POP-UP ===== */
var photo = null;
$("open").onclick = function() {
  $("f").reset();
  photo = null;
  $("drop").className = "drop";
  $("drop").style.backgroundImage = "";
  $("dropText").textContent = "Tap to add a photo of the food";
  $("dlg").showModal();
};

$("cancel").onclick = function() { $("dlg").close(); };

$("drop").onkeydown = function(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("file").click();
  }
};

$("file").onchange = function() {
  var f = this.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function() {
    photo = r.result;
    $("drop").className = "drop has";
    $("drop").style.backgroundImage = "url(" + photo + ")";
  };
  r.readAsDataURL(f);
};

$("f").onsubmit = function() {
  var h = parseInt($("hrs").value, 10), d = $("diet").value;
  var addr = $("addr").value.trim();
  var serv = parseInt($("serv").value, 10) || 1;

  posts.unshift({
    org: "You",
    av: "🙋",
    where: "Just posted",
    pickupAddress: addr,
    addr: addr,
    until: safeUntil(h),
    title: $("title").value.trim(),
    desc: $("desc").value.trim() || "Pickup details to be confirmed.",
    servings: serv,
    serv: serv,
    hrs: h,
    tags: d ? [d] : [],
    warn: [],
    emoji: "🍽️",
    g: "#E8DFC0,#C7B77A",
    img: photo,
    fresh: true
  });

  filter = "All";
  chips();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("Posted. Nearby receivers will be alerted.");
};

/* ===== 7. FETCH LISTINGS FROM FASTAPI ===== */
function loadListings() {
  return fetch("/listings")
    .then(function(res) {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.json();
    })
    .then(function(data) {
      if (Array.isArray(data)) {
        posts = data;
        render();
      }
      return data;
    })
    .catch(function(err) {
      console.error("Failed to load listings:", err);
    });
}

window.loadListings = loadListings;

/* ===== 8. STARTUP ===== */
chips();
render();
loadListings();
