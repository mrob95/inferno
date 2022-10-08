"use strict";
var details, searchbtn, unzoombtn, matchedtxt, svg, searching, frames;
function init(evt) {
    details = document.getElementById("details").firstChild;
    searchbtn = document.getElementById("search");
    unzoombtn = document.getElementById("unzoom");
    matchedtxt = document.getElementById("matched");
    svg = document.getElementsByTagName("svg")[0];
    frames = document.getElementById("frames");
    total_samples = parseInt(frames.attributes.total_samples.value);
    searching = 0;

    // Use GET parameters to restore a flamegraph's state.
    var restore_state = function() {
        var params = get_params();
        if (params.x && params.y)
            zoom(find_group(document.querySelector('[*|x="' + params.x + '"][y="' + params.y + '"]')));
        if (params.s)
            search(params.s);
    };

    if (fluiddrawing) {
        // Make width dynamic so the SVG fits its parent's width.
        svg.removeAttribute("width");
        // Edge requires us to have a viewBox that gets updated with size changes.
        var isEdge = /Edge\/\d./i.test(navigator.userAgent);
        if (!isEdge) {
            svg.removeAttribute("viewBox");
        }
        var update_for_width_change = function() {
            if (isEdge) {
                svg.attributes.viewBox.value = "0 0 " + svg.width.baseVal.value + " " + svg.height.baseVal.value;
            }

            // Keep consistent padding on left and right of frames container.
            frames.attributes.width.value = svg.width.baseVal.value - xpad * 2;

            // Text truncation needs to be adjusted for the current width.
            var el = frames.children;
            update_text_for_elements(el);

            // Keep search elements at a fixed distance from right edge.
            var svgWidth = svg.width.baseVal.value;
            searchbtn.attributes.x.value = svgWidth - xpad;
            matchedtxt.attributes.x.value = svgWidth - xpad;
        };
        window.addEventListener('resize', function() {
            update_for_width_change();
        });
        // This needs to be done asynchronously for Safari to work.
        setTimeout(function() {
            unzoom();
            update_for_width_change();
            restore_state();
        }, 0);
    } else {
        restore_state();
    }
}
// event listeners
window.addEventListener("click", function(e) {
    var target = find_group(e.target);
    if (target) {
        if (target.nodeName == "a") {
            if (e.ctrlKey === false) return;
            e.preventDefault();
        }
        if (target.classList.contains("parent")) unzoom();
        zoom(target);

        // set parameters for zoom state
        var el = target.querySelector("rect");
        if (el && el.attributes && el.attributes.y && el.attributes["fg:x"]) {
            var params = get_params()
            params.x = el.attributes["fg:x"].value;
            params.y = el.attributes.y.value;
            history.replaceState(null, null, parse_params(params));
        }
    }
    else if (e.target.id == "unzoom") {
        unzoom();

        // remove zoom state
        var params = get_params();
        if (params.x) delete params.x;
        if (params.y) delete params.y;
        history.replaceState(null, null, parse_params(params));
    }
    else if (e.target.id == "search") search_prompt();
}, false)
// mouse-over for info
// show
window.addEventListener("mouseover", function(e) {
    var target = find_group(e.target);
    if (target) details.nodeValue = nametype + " " + g_to_text(target);
}, false)
// clear
window.addEventListener("mouseout", function(e) {
    var target = find_group(e.target);
    if (target) details.nodeValue = ' ';
}, false)
// ctrl-F for search
window.addEventListener("keydown",function (e) {
    if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) {
        e.preventDefault();
        search_prompt();
    }
}, false)
// functions
function get_params() {
    var params = {};
    var paramsarr = window.location.search.substr(1).split('&');
    for (var i = 0; i < paramsarr.length; ++i) {
        var tmp = paramsarr[i].split("=");
        if (!tmp[0] || !tmp[1]) continue;
        params[tmp[0]]  = decodeURIComponent(tmp[1]);
    }
    return params;
}
function parse_params(params) {
    var uri = "?";
    for (var key in params) {
        uri += key + '=' + encodeURIComponent(params[key]) + '&';
    }
    if (uri.slice(-1) == "&")
        uri = uri.substring(0, uri.length - 1);
    if (uri == '?')
        uri = window.location.href.split('?')[0];
    return uri;
}
function find_child(node, selector) {
    var children = node.querySelectorAll(selector);
    if (children.length) return children[0];
    return;
}
function find_group(node) {
    var parent = node.parentElement;
    if (!parent) return;
    if (parent.id == "frames") return node;
    return find_group(parent);
}
function orig_save(e, attr, val) {
    if (e.attributes["fg:orig_" + attr] != undefined) return;
    if (e.attributes[attr] == undefined) return;
    if (val == undefined) val = e.attributes[attr].value;
    e.setAttribute("fg:orig_" + attr, val);
}
function orig_load(e, attr) {
    if (e.attributes["fg:orig_"+attr] == undefined) return;
    e.attributes[attr].value = e.attributes["fg:orig_" + attr].value;
    e.removeAttribute("fg:orig_" + attr);
}
function g_to_text(e) {
    var text = find_child(e, "title").firstChild.nodeValue;
    return (text)
}
function g_to_func(e) {
    var func = g_to_text(e);
    // if there's any manipulation we want to do to the function
    // name before it's searched, do it here before returning.
    return (func);
}
function update_text_for_elements(elements) {
    testElement = find_child(elements[0], "text");
    var textElemNewAttributes = [];
    for (var i = 0; i < elements.length; i++) {
        var e = elements[i];
        var r = find_child(e, "rect");
        var w = parseFloat(r.attributes.width.value) * frames.attributes.width.value / 100 - 3;
        var txt = find_child(e, "title").textContent.replace(/\([^(]*\)$/,"");
        newX = format_percent((parseFloat(r.attributes.x.value) + (100 * 3 / frames.attributes.width.value)));


        // Smaller than this size won't fit anything
        if (w < 2 * fontsize * fontwidth) {
            textElemNewAttributes.push([newX, ""]);
            continue;
        }
        testElement.textContent = txt;
        // Fit in full text width
        if (/^ *\$/.test(txt) || testElement.getComputedTextLength() < w) {
            textElemNewAttributes.push([newX, txt]);
            continue;
        }
        // Will only fit ".. "
        if (testElement.getSubStringLength(txt.length-4, txt.length) >= w) {
            textElemNewAttributes.push([newX, ""]);
            continue;
        }


        // Binary search for a substring length which just about fits into the space,
        // based on this algorithm:
        // https://en.wikipedia.org/wiki/Binary_search_algorithm#Alternative_procedure
        m = Math.floor(txt.length / 2);
        l = 2;
        r = txt.length-2;
        done = false;
        if (truncate_text_right) {
            // Truncate the right side of the text, higher m means more text shown.
            while (!done) {
                m = Math.ceil((l+r)/2);
                fits = testElement.getSubStringLength(0, m + 2) <= w;
                done = l == r;
                if (fits && done) {
                    textElemNewAttributes.push([newX, txt.substring(0, m) + ".."]);
                    break;
                } else if (fits) {
                    l = m; // fits, bring the left edge of the search space to the middle
                } else if (!fits && done) {
                    textElemNewAttributes.push([newX, txt.substring(0, m-1) + ".."]);
                    break;
                } else if (!fits) {
                    r = m-1; // doesn't fit, bring the right edge of the search space to the middle
                }
            }
        } else {
            // Truncate the left side of the text, higher m means less text shown.
            while (!done) {
                m = Math.ceil((l+r)/2);
                fits = testElement.getSubStringLength(m - 2, txt.length) <= w;
                done = l == r;
                if (fits && done) {
                    textElemNewAttributes.push([newX, ".." + txt.substring(m, txt.length)]);
                    break;
                } else if (fits) {
                    r = m-1; // fits, bring the right edge of the search space to the middle
                } else if (!fits && done) {
                    textElemNewAttributes.push([newX, ".." + txt.substring(m+1, txt.length)]);
                    break;
                } else if (!fits) {
                    l = m; // doesn't fit, bring the left edge of the search space to the middle
                }
            }
        }
    }
    if (textElemNewAttributes.length !== elements.length) {
        console.log("UH OH", textElemNewAttributes.length, elements.length);
        return;
    }

    for (var i = 0; i < elements.length; i++) {
        var e = elements[i];
        var values = textElemNewAttributes[i];
        var t = find_child(e, "text");
        t.attributes.x.value = values[0];
        t.textContent = values[1];
    }
}
// zoom
function zoom_reset(e) {
    if (e.tagName == "rect") {
        e.attributes.x.value = format_percent(100 * parseInt(e.attributes["fg:x"].value) / total_samples);
        e.attributes.width.value = format_percent(100 * parseInt(e.attributes["fg:w"].value) / total_samples);
    }
    if (e.childNodes == undefined) return;
    for(var i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_reset(c[i]);
    }
}
function zoom_child(e, x, zoomed_width_samples) {
    if (e.tagName == "text") {
        var parent_x = parseFloat(find_child(e.parentNode, "rect[x]").attributes.x.value);
        e.attributes.x.value = format_percent(parent_x + (100 * 3 / frames.attributes.width.value));
    } else if (e.tagName == "rect") {
        e.attributes.x.value = format_percent(100 * (parseInt(e.attributes["fg:x"].value) - x) / zoomed_width_samples);
        e.attributes.width.value = format_percent(100 * parseInt(e.attributes["fg:w"].value) / zoomed_width_samples);
    }
    if (e.childNodes == undefined) return;
    for(var i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_child(c[i], x, zoomed_width_samples);
    }
}
function zoom_parent(e) {
    if (e.attributes) {
        if (e.attributes.x != undefined) {
            e.attributes.x.value = "0.0%";
        }
        if (e.attributes.width != undefined) {
            e.attributes.width.value = "100.0%";
        }
    }
    if (e.childNodes == undefined) return;
    for(var i = 0, c = e.childNodes; i < c.length; i++) {
        zoom_parent(c[i]);
    }
}
function zoom(node) {
    var attr = find_child(node, "rect").attributes;
    var width = parseInt(attr["fg:w"].value);
    var xmin = parseInt(attr["fg:x"].value);
    var xmax = xmin + width;
    var ymin = parseFloat(attr.y.value);
    unzoombtn.classList.remove("hide");
    var el = frames.children;
    var to_update_text = [];
    for (var i = 0; i < el.length; i++) {
        var e = el[i];
        var a = find_child(e, "rect").attributes;
        var ex = parseInt(a["fg:x"].value);
        var ew = parseInt(a["fg:w"].value);
        // Is it an ancestor
        if (!inverted) {
            var upstack = parseFloat(a.y.value) > ymin;
        } else {
            var upstack = parseFloat(a.y.value) < ymin;
        }
        if (upstack) {
            // Direct ancestor
            if (ex <= xmin && (ex+ew) >= xmax) {
                e.classList.add("parent");
                zoom_parent(e);
                to_update_text.push(e);
            }
            // not in current path
            else
                e.classList.add("hide");
        }
        // Children maybe
        else {
            // no common path
            if (ex < xmin || ex >= xmax) {
                e.classList.add("hide");
            }
            else {
                zoom_child(e, xmin, width);
                to_update_text.push(e);
            }
        }
    }
    update_text_for_elements(to_update_text);
}
function unzoom() {
    unzoombtn.classList.add("hide");
    var el = frames.children;
    for(var i = 0; i < el.length; i++) {
        el[i].classList.remove("parent");
        el[i].classList.remove("hide");
        zoom_reset(el[i]);
    }
    update_text_for_elements(el);
}
// search
function reset_search() {
    var el = document.querySelectorAll("#frames rect");
    for (var i = 0; i < el.length; i++) {
        orig_load(el[i], "fill")
    }
    var params = get_params();
    delete params.s;
    history.replaceState(null, null, parse_params(params));
}
function search_prompt() {
    if (!searching) {
        var term = prompt("Enter a search term (regexp " +
            "allowed, eg: ^ext4_)", "");
        if (term != null) {
            search(term)
        }
    } else {
        reset_search();
        searching = 0;
        searchbtn.classList.remove("show");
        searchbtn.firstChild.nodeValue = "Search"
        matchedtxt.classList.add("hide");
        matchedtxt.firstChild.nodeValue = ""
    }
}
function search(term) {
    var re = new RegExp(term);
    var el = frames.children;
    var matches = new Object();
    var maxwidth = 0;
    for (var i = 0; i < el.length; i++) {
        var e = el[i];
        // Skip over frames which are either not visible, or below the zoomed-to frame
        if (e.classList.contains("hide") || e.classList.contains("parent")) {
            continue;
        }
        var func = g_to_func(e);
        var rect = find_child(e, "rect");
        if (func == null || rect == null)
            continue;
        // Save max width. Only works as we have a root frame
        var w = parseInt(rect.attributes["fg:w"].value);
        if (w > maxwidth)
            maxwidth = w;
        if (func.match(re)) {
            // highlight
            var x = parseInt(rect.attributes["fg:x"].value);
            orig_save(rect, "fill");
            rect.attributes.fill.value = searchcolor;
            // remember matches
            if (matches[x] == undefined) {
                matches[x] = w;
            } else {
                if (w > matches[x]) {
                    // overwrite with parent
                    matches[x] = w;
                }
            }
            searching = 1;
        }
    }
    if (!searching)
        return;
    var params = get_params();
    params.s = term;
    history.replaceState(null, null, parse_params(params));

    searchbtn.classList.add("show");
    searchbtn.firstChild.nodeValue = "Reset Search";
    // calculate percent matched, excluding vertical overlap
    var count = 0;
    var lastx = -1;
    var lastw = 0;
    var keys = Array();
    for (k in matches) {
        if (matches.hasOwnProperty(k))
            keys.push(k);
    }
    // sort the matched frames by their x location
    // ascending, then width descending
    keys.sort(function(a, b){
        return a - b;
    });
    // Step through frames saving only the biggest bottom-up frames
    // thanks to the sort order. This relies on the tree property
    // where children are always smaller than their parents.
    for (var k in keys) {
        var x = parseInt(keys[k]);
        var w = matches[keys[k]];
        if (x >= lastx + lastw) {
            count += w;
            lastx = x;
            lastw = w;
        }
    }
    // display matched percent
    matchedtxt.classList.remove("hide");
    var pct = 100 * count / maxwidth;
    if (pct != 100) pct = pct.toFixed(1);
    matchedtxt.firstChild.nodeValue = "Matched: " + pct + "%";
}
function format_percent(n) {
    return n.toFixed(4) + "%";
}
