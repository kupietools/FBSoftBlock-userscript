// ==UserScript==
// @name          FBSoftBlock
// @namespace     http://www.kupietz.com/FBSoftBlock
// @description	Version 3.0: silently and reversibly block people on Facebook without them knowing you have them blocked.
// @include         http://*
// @include         https://*
// @grant       none
// @require     https://gist.githubusercontent.com/arantius/3123124/raw/grant-none-shim.js
// @require       https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js
// ==/UserScript==
/*
  Author: Michael Kupietz https://www.kupietz.com

 This script is provided as-is. My javascript is sloppy, this was patched together with kite string and scotch tape over many years. 
  It sucks. It will break your computer. You shouldn't use it.

    Should you choose to use this script, you are licensed to use it only 
    for good, never for evil. Evil uses are strictly prohibited.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

  Version: 3.0
  3.0 - forked from WebCooler 

*/
// Licensed for unlimited modification and redistribution as long as
// this notice is kept intact.


/************************************************************************************************
 *************************************** USER SETTINGS ******************************************
 ************************************************************************************************/

var namesToBlock = ["JP Sears","Lexi Stern","SecondName GoesHere","Third Here","John Doe"]; 
/* Above are the FB display names of the people to block. Get the capitalization and any 
   punctuation exactly right. Never include a blank name "" or you'll break stuff. */

var superblock = true;
/* If superblock is set to true, it will hide: 
  -entire reply threads if the link at the top of the replies, like "John Doe replied • 8 comments", contains the name of a namesToBlock person
  -"liked by" lines if they mention a namesToBlock person
  If superblock is false, it will still show the name in those lines, but still hide that person's replies and comments
  in the thread. */


/************************************************************************************************
 ******************** END USER SETTINGS - DON'T TOUCH ANYTHING BELOW HERE ***********************
 ************************************************************************************************/
var stupidHashesToBlock = ["18.324747616836948", "37.0434273970199", "201.91846288003606"]; /* developer use only */

var nodeSerial = 0;
var observerEnable = true;

/* debugging options */
var CONSOLE_DEBUGGING_MESSAGES_ON = false; //log debug messages?
var HILIGHT_ELEMENTS_BEING_PROCESSED = false; //visual cue as each page element is processed?
var RECORD_DEBUGGING_INFO_IN_NODE_ATTRIBUTES_AS_THEY_ARE_PROCESSED = false; //Do I even use this anymore? I dunno
var MAX_NUMBER_OF_CALLS_PER_PAGE = 1000000; //prevent endless loops. Set to very high number for actual production use.
var thisPageIsExempt = false; //set to true for testing

logForDebugging("Starting - logging ", CONSOLE_DEBUGGING_MESSAGES_ON);

this.$ = this.jQuery = jQuery.noConflict(true);
/* necessary for compatibility, according to https://wiki.greasespot.net/@grant */

/* from webcooler.xpi contentScript.js */


var replacementText = ""; //put replacement text here. NOPE, NOT USED ANYMORE.

var exemptSites = "^x$";

/* Now, some useful definitions for the below sections: */

/* FB-specific selectors */
var fb_OutermostWhiteBox = "div._4-u2"; /*Does this ever change? We'll see. */
var fb_post = "div.fbUserContent"; /* entire post */
var fb_postContent =
  "div._1dwg"; /*._1dwg is around post content (the top) but not comments or the bar with "like, share" etc. */
/* site-specific extras to consider with selectorsToConsiderTogether: */
var siteSpecificSelectorsToConsiderTogether = 'li._5i_q|div#m_story_permalink_view>div>div>div>div|div table[role=presentation]|div.UFIReplyList|div.UFILikeSentence|div[aria-label="Comment"]|div[role="article"]|li.jewelItemNew|div._3soj|div.UFIRow.UFIComment|div._1yt|li._5my2|li._58rc|div._4-u3|' + fb_postContent;
  /* li._5my2 is 'trending' row. div.div._4-u3 is a "related article" beneath a share. 
  li._58rc is a 'related content' box. div._1yt is a search result post */
 /* like pop-up list row */

/* div._NId>div.srg>div.g google search result */
/* li.jewelItemNew is notification row */
/*div[role=article] is mbasic.facebook.com article */
/* div.bt.bu.bv.bw mbasic.facebook.com notification row */
/* I *think* div._3soj is a notification popup bubble. */
/* Other things to always hide. Useful to, say, hide an entire facebook post only if the main comment comtains badwords, but _not_ if a reply comment does. 
 (Hence siteSpecificSelectorsToConsiderTogether wouldn't do the trick.) */

var siteSpecificSelectorsToAlwaysHide = "div.UFIRow.UFIComment[hiddenbyscript=true]+div.UFIReplyList|div[data-referrer='pagelet_trending_tags_and_topics']|" +
    fb_OutermostWhiteBox +
    ":has(" +
    fb_postContent +
    "[hiddenbyscript=true])|"+
    fb_OutermostWhiteBox +
    ":has(div._14bf)";
/* NOTE: div._4-u2 is the outer container for a facebook post (and any other white box on their gray background as of this writing. Does this ever change? We'll see. div.fbUserContent is right inside that and seems less likely to change, but the outer one has the margins. */
/* ._5r69 seems to be the div surrounding a shared post. */
/* _5x46 is the header with who posted and who it was shared from */
/* div._14bf is either "suggested post" or "sponsored" */

/* before simplification, FB also had "div.fbUserContent:has(div.fbUserContent:has(div.userContent[hiddenbyscript=true]))|div._4-u2.mbm._4mrt._5jmm._5pat._5v3q._4-u8:has(div.userContent:has([hiddenbyscript=true]))|div._5r69:has([hiddenbyscript=true])|div._5x46:has([hiddenbyscript=true])|div._4-u2.mbm._4mrt._5jmm._5pat._5v3q._4-u8:has(div._5x46[hiddenbyscript=true])|div._4-u2.mbm._4mrt._5jmm._5pat._5v3q._4-u8:has(div._1dwg[hiddenbyscript=true])|" */

/*** END BLOCKING LISTS ***/

/*** USER: END GLOBAL VARIABLES ***/

/* Let's get our variables together & tailored to whatever the current site is */

logForDebugging("Checking keys now");
var badFBNames = namesToBlock.join("|")+"|"+stupidHashesToBlock.join("|");
var selectorsToConsiderTogether =  siteSpecificSelectorsToConsiderTogether;
var selectorsToConsiderTogetherRegex = selectorsToConsiderTogether.replace(/\|/g, ",");
logForDebugging("selectorsToConsiderTogether ", selectorsToConsiderTogether);
var selectorsToAlwaysHide = siteSpecificSelectorsToAlwaysHide;
var selectorsToAlwaysHideRegex= selectorsToAlwaysHide.replace(/\|/g, ",");
logForDebugging("selectorsToAlwaysHide ", selectorsToAlwaysHide);

var exemptRegexp = new RegExp(exemptSites, "gi");
var theBadFBNames = new RegExp("mdelimiter("+badFBNames+")mdelimiter", "gi");
var theBadFBNamesNoDelimiter = new RegExp(badFBNames, "gi");


/* Create our artisanal handcrafted regexes to use below */
var theBadWordsAndFBNames = new RegExp("("+badFBNames+")", "gi");

 $(document.body).attr("wcHash",stupidHash(document.location.href)); /* custom hash usable in exemptsites variable */


function stupidHash (theString) {
	var j;var out=1;
	for(j = 0; j < theString.length; j++) {
		out=out*  (1.0001+((theString.charCodeAt(j))+j)/(256+j));
	} return out.toString();
}

function stupidHashArray (theArray) {
  
var newArray=[];
var arrayLength = theArray.length;
for (var i = 0; i < arrayLength; i++) {
    newArray[i]=stupidHash(theArray[i]);
    //Do something
} 
return newArray;
}

function main(elLengthOld, theDelay, mutation, sessionID) {
  /* big stuff happens here */
  observerEnable = false;
  if (HILIGHT_ELEMENTS_BEING_PROCESSED) {
    observerEnable = false;
    mutation.target.style =
      "border: 5px dotted rgba(100,0,100,1) !important; background:rgb(100,0,100) !important;" +
      mutation.target.style;
    $(mutation.target).data("highlighted", true);
    observerEnable = true;
  }
  var d = new Date();
  var n = d.getTime(); /* Are these used? */

  logForDebugging("checking node:", mutation.target);
  if (
    typeof $(mutation.target).data() === "object" &&
    (!$(mutation.target).data("scriptprocid") ||
      $(mutation.target).data("scriptprocid") != sessionID)
  ) {
    wcSetAttributeSafely(mutation.target, "scriptprocid", sessionID);
    logForDebugging("Confirmed not yet checked this session:", mutation.target);
    logForDebugging("about to find selectorsToConsiderTogether:", "");

  var theseAnodes= $(mutation.target)
        .find("span.fwb, a[data-hovercard],a[href^='/comment/replies'],span._4arz,span.blueName,div._6234,span.UFIReplySocialSentenceLinkText").addBack("span.fwb,a[href^='/comment/replies'],span._4arz,a[data-hovercard],div._6234,span.UFIReplySocialSentenceLinkText").filter(function() { // WAS  .find("A,span.fwb") , BUT DON'T NEED A, NAME IS ENOUGH
 return (typeof $(this).data() === "object" &&
    (!$(this).data("scriptprocid") ||
      $(this).data("scriptprocid") != sessionID)
        );
        });
 
/* that was A selectors to consider together, this is other A nodes */
      
      var aWalk = theseAnodes.filter(function() {
            wcSetAttributeSafely(this, "scriptprocid", sessionID);
            var itsFWBSpan = (typeof this.tagName) === 'string' && this.tagName=="SPAN" /* fails if not uppercase */ && ($(this).hasClass("fwb")||$(this).hasClass("blueName")) ;
            var itsDataHovercard = (typeof this.tagName) === 'string' && this.tagName=="A" && $(this).is("[data-hovercard]");
            var itsVideoName = (typeof this.tagName) === 'string' && this.tagName=="DIV" /* fails if not uppercase */ && $(this).hasClass("_6234");
       var itsAname= (itsFWBSpan || itsDataHovercard || itsVideoName) && (("mdelimiter"+$(this).text()+"mdelimiter").match(theBadFBNames) || ("mdelimiter"+stupidHash($(this).text())+"mdelimiter").match(theBadFBNames));  /* Yes, if you're smart enough to read this far you may realize that in addition to blocking names, you can encode names using the stupidHash function and block those using the "stupidHashesToBlock" variable. Either you see the usefulness of this, or you don't need it. */
            var itsReplyLine =  superblock==true && (typeof this.tagName) === 'string' && this.tagName=="SPAN" /* fails if not uppercase */ && $(this).hasClass("UFIReplySocialSentenceLinkText")  && (("mdelimiter"+$(this).text().replace(/ replied.*$/i,"")+"mdelimiter").match(theBadFBNames) ||( "mdelimiter"+stupidHash($(this).text().replace(/ replied.*$/i,""))+"mdelimiter").match(theBadFBNames));
            var itsLikeLine = superblock==true && (typeof this.tagName) === 'string' && this.tagName=="SPAN" /* fails if not uppercase */ && $(this).hasClass("_4arz")  &&( ("mdelimiter"+$(this).text().replace(/ and [0-9]+ other.*$/i,"")+"mdelimiter").match(theBadFBNames) ||  ("mdelimiter"+stupidHash($(this).text().replace(/ and [0-9]+ other.*$/i,""))+"mdelimiter").match(theBadFBNames));
     var itsMbasicReplyLine = (typeof this.tagName) === 'string' && this.tagName=="A" && this.href.match(/https?\:\/\/mbasic\.facebook\.com\/comment\/replies/)  && (("mdelimiter"+$(this).text().replace(/ replied.*$/i,"")+"mdelimiter").match(theBadFBNames) ||( "mdelimiter"+stupidHash($(this).text().replace(/ replied.*$/i,""))+"mdelimiter").match(theBadFBNames));
    /* even though href in code doesn't contain domain name, href as detected by javascript does. href as detected by jquery selector [href^='/comment/replies'] doesn't, though*/
   logForDebugging("found A section filtering",$(this).text());
            logForDebugging("itsMbasicReplyLine",itsMbasicReplyLine);
logForDebugging( "(typeof this.tagName) === 'string' && this.tagName=='A'",(typeof this.tagName) === 'string' && this.tagName=='A');
logForDebugging("this.href.match(/^\/comment\/replies/) ",  $(this).is("[href^='/comment/replies']")); 
logForDebugging(' (("mdelimiter"+$(this).text().replace(/ replied.*$/i,"")+"mdelimiter").match(theBadFBNames) ||( "mdelimiter"+stupidHash($(this).text().replace(/ replied.*$/i,""))+"mdelimiter").match(theBadFBNames));', (("mdelimiter"+$(this).text().replace(/ replied.*$/i,"")+"mdelimiter").match(theBadFBNames) ||( "mdelimiter"+stupidHash($(this).text().replace(/ replied.*$/i,""))+"mdelimiter").match(theBadFBNames)));





           /* logForDebugging("itsAname",itsAname);
            logForDebugging("(typeof this.tagName) === 'string'",(typeof this.tagName) === 'string');
            logForDebugging("this.tagName=='span'",this.tagName);
            logForDebugging("$(this).hasClass('fwb')",$(this).hasClass("fwb"));
            logForDebugging("('mdelimiter'+$(this).text()+'mdelimiter').match(theBadFBNames)",("mdelimiter"+$(this).text()+"mdelimiter").match(theBadFBNames));*/

            return (itsAname || itsReplyLine || itsLikeLine || itsMbasicReplyLine);
        })
        .filter(function() {
          logForDebugging("filtering A section pt II node:", this);
          logForDebugging("filtered A section pt II node value is:", this.nodeValue);
          var theCriteria =
          
           (document.activeElement.tagName=="BODY"?true: (  $(this).prop("isContentEditable")==false &&  $(this).has("[contenteditable]").length==0)) ; /* rejects anything with editable descendants */
/* was            !$(this).prop(
              "isContentEditable"
            ) /~ cant use === false because .prop("isContentEditable") === undefined for text nodes ~/ */
          logForDebugging(
            "the A section filter returns (true for include):",
            theCriteria
          );
          if (theCriteria && CONSOLE_DEBUGGING_MESSAGES_ON) {
             
                          logForDebugging(
              "Matched purple contents ",
             ("mdelimiter"+$(this).text()+"mdelimiter").match(theBadFBNames)
            );
 
          

}
 
          return theCriteria;
        });
      logForDebugging("about to walk A leaves in A section:", aWalk);

      aWalk.each(function() {
        logForDebugging(
          "walking A section leaf:",
          this[0] || this
        ); /* don't know why this[0] is sometimes, maybe always, not evaluating. don't care right now. maybe needs to be $(this)[0]?*/
        var theClosest = $(this).closest(
          selectorsToConsiderTogetherRegex
        ); /* I need to use nextUntil() and prevUntil() to add consecutive sibling dd's and dt's to theClosest so one doesn't get left if the other is removed. See https://en.wikipedia.org/wiki/List_of_music_considered_the_worst for example. Too tired to do it right now though. */
        var theClosestBlock =  theClosest.length === 0 ?  $(this).closest(
      "p,div,td,table,h1,h2,h3,h4,h5,h6,li,dd,dt" /* '[style*=display:block]' */
        ) : theClosest;
        theClosest = theClosest.length === 0 ? theClosestBlock : theClosest;
        /* sometimes the mutation target is just a text node that changed (like clicking a "more" link on facebook. In that case, see if it's enclosed in one of selectorsToConsiderTogether before just looking for the closest() parent block element. */ logForDebugging(
          "theClosestBlock:",
          theClosestBlock
        );
        logForDebugging("theClosest:", theClosest);
        if (thisPageIsExempt == true) {
          theClosest
            .css("border", "1px solid aqua")
            .css("background", "rgba(150,250,250,.5)")
            .attr("hiddenByScript", "true");
          if (theClosest != theClosestBlock) {
            theClosestBlock
              .css("border", "1px dotted aqua")
              .css("background", "rgba(150,250,250,.5)")
              .attr("hiddenByScript", "true");
          }
        } 
          else   {
          theClosest
            .hide()
            .data("savedstyle", theClosest.attr("style"))
            .attr("style", "display:none !important")
            .attr("hiddenByScript", "true");
        }
        logForDebugging(
          "added aqua to",
          theClosest[0] || theClosest
        ); /* don't know why theClosest[0] is sometimes, maybe always, not evaluating. don't care right now. */
      });
      logForDebugging("done walking A section text leaves", aWalk);
    

    addUnblockLink(
      /*theCatch*/ "x"
    ); /* should prob move this so unblock link only shows if block term was actually found on page. */
    logForDebugging("done adding unblock link");
  } else {
    logForDebugging("skipped:", mutation.target);
    wcSetDebuggingAttributeSafely(
      mutation.target,
      "thisNodeSkippedForSession",
      sessionID
    );
  }

  /* Now let's check for wrongly hidden things. this is because sometimes Twitter seems to be setting input fields temporarily to uneditable while backspace key is being hit, and the script jumps in and hides them. */


  /* this isn't the best way to do this, I don't think. Sometimes a hiddenbyscript element CONTAINS an editable one. Not sure if this catches those. (UPDATE: seems to be working, will fix if it doesn't always. */
if(document.activeElement.tagName != "BODY") { /* only do if there is an active input element */

  var hiddenWalk = $(mutation.target)
    .find('[hiddenByScript=true]:has([contenteditable])')
    .addBack("[hiddenByScript=true]:has([contenteditable])");
  if (thisPageIsExempt) {
    hiddenWalk.each(function() {
      logForDebugging("unhiding text leaf:", this);

      $(this)
        .css("border", "1px solid blue")
        .css("background", "#CCCCFF")
        .css("background", "rgba(225,225,255,.5)")
        .attr("style", $(this).data("savedstyle"))
        .attr("hiddenByScript", "");

      logForDebugging("added blue to", $(this));
    });
  } 
    else {
    hiddenWalk.each(function() {
      logForDebugging("unhiding text leaf:", this);
      $(this).show().attr("hiddenByScript", "");
      logForDebugging("added blue to", $(this));
    });
  }
}

  var theSelectorsToAlwaysHide = $(mutation.target)
    .find(selectorsToAlwaysHideRegex)
    .not("[hiddenbyscript]");
  //while (theSelectorsToAlwaysHide ) {
  theSelectorsToAlwaysHide.each(function() {
    /* we do this _after_ seaching for badwords so selectortoalwayshide that use [hiddenbyscript] will get catch things that were just hidden */

    if (thisPageIsExempt) {
      $(this)
        .css("border", "1px solid orange")
        .css("background", "rgba(255,240,225,.5")
        .attr("hiddenByScript", "true");
      logForDebugging("Added orange to", $(this));
    } else {
      $(this).hide().attr("hiddenByScript", "true");
      logForDebugging("Added orange to", $(this));
    }

    logForDebugging("added orange to", this);
  });
  //  theSelectorsToAlwaysHide = $(mutation.target).find(selectorsToAlwaysHide.replace(/\|/g, ",")).not("[hiddenbyscript]");
  //}

  observerEnable = true;
} //end main()

//*************** BEGIN GLOBAL SCOPE ****************//

//******* My own functions for global scope ********//

function logForDebugging(string, object) {
  if (CONSOLE_DEBUGGING_MESSAGES_ON) {
    console.log(string);
    console.log(object);
  } //enable this to turn logging on
}

function wcSetAttributeSafely(node, attribute, value) {
  if (typeof $(node).data() === "object") {
    $(node).data(attribute, value);
  } else if (node.nodeType == 3) {
    wcSetDebuggingAttributeSafely(
      node.parentNode,
      attribute + "__in_child_" + node.nodeValue.replace(/\b/g, "") + "__",
      value
    );
  }
  //else {node.textContent=node.textContent + "{§"+attribute+"="+value+"§}"}
}

function wcSetDebuggingAttributeSafely(node, attribute, value) {
  if (RECORD_DEBUGGING_INFO_IN_NODE_ATTRIBUTES_AS_THEY_ARE_PROCESSED == true) {
    if (typeof $(node).data() === "object") {
      $(node).data(attribute, value);
    } else if (node.nodeType == 3) {
      wcSetDebuggingAttributeSafely(
        node.parentNode,
        attribute + "__in_child_" + node.nodeValue.replace(/\b/g, "") + "__",
        value
      );
    }
    //else {node.textContent=node.textContent + "{§"+attribute+"="+value+"§}"}
  }
}

function wcSetAttributeSafelyOLD(node, attribute, value) {
  if (typeof node.setAttribute === "function") {
    node.setAttribute(attribute, value);
  } else if (node.nodeType == 3) {
    wcSetDebuggingAttributeSafely(
      node.parentNode,
      attribute + "__in_child_" + node.nodeValue.replace(/\b/g, "") + "__",
      value
    );
  }
  //else {node.textContent=node.textContent + "{§"+attribute+"="+value+"§}"}
}

function wcSetDebuggingAttributeSafelyOLD(node, attribute, value) {
  if (RECORD_DEBUGGING_INFO_IN_NODE_ATTRIBUTES_AS_THEY_ARE_PROCESSED == true) {
    if (typeof node.setAttribute === "function") {
      node.setAttribute(attribute, value);
    } else if (node.nodeType == 3) {
      wcSetDebuggingAttributeSafely(
        node.parentNode,
        attribute + "__in_child_" + node.nodeValue.replace(/\b/g, "") + "__",
        value
      );
    }
    //else {node.textContent=node.textContent + "{§"+attribute+"="+value+"§}"}
  }
}

function exemptThisPage() {return false;
}

function unexemptThisPage() {return false;}

function addUnblockLink(foundString) {return false;}
   
//******* End my own functions for global scope ********//


/* don't run at all on excluded sites */
    logForDebugging ("exempt regexp",exemptRegexp);
    logForDebugging ("exempt document.location.href",document.location.href);
    logForDebugging ("regexp is ",document.location.href.match(exemptRegexp));
    logForDebugging ("regexp result ", (document.location.href.match(exemptRegexp) === null));
logForDebugging ("Page stupidHash is ",stupidHash(document.location.href));
    logForDebugging ("stupidHash regexp result ", (stupidHash(document.location.href).match(exemptRegexp) === null));
                 
  if (document.location.href.match(exemptRegexp) === null && stupidHash(document.location.href).match(exemptRegexp) === null ) {



logForDebugging("EXEMPTION: thisPageIsExempt ", thisPageIsExempt);
var theDummy = {
  target: document.body
};
var aMutationObserver =
  window.MutationObserver || window.WebKitMutationObserver;
/* watch the page for changes. A lot of page load content later by AJAX or other javascript. */
var observer = new aMutationObserver(function(mutations, observer) {
  if ((document.mkObserverFlag === undefined || 1 == 1) && observerEnable) {
    observer.disconnect(); /* this can go, was just an attempt at what observerEnable succeeded at. do a search for all mentions and remove. */
    /* document.mkObserverFlag = 1;*/ var thisSessionID = Math.random();
    var mlog = {};
    //log mutation
    // mutations.forEach(function (mutation) {
    //    mlog[mutation.type] = (mlog[mutation.type] || 0) + 1;
    //});
    //logForDebugging("keys",Object.keys(mlog).map(function (k) {
    //   return k + '=' + mlog[k];
    //}).join(', '))
    //end log

    var theNodes =
      mutations ||
      document.body
        .childNodes; /* do we really need that bit? commenting to see if anything breaks */
 
    $("html,body").css("cursor", "not-allowed");
    if (thisPageIsExempt) {
      //add div to allow user to unexempt page
      var aMain = document.createElement("div");
      aMain.addEventListener(
        "click",
        function() {
          unexemptThisPage(0);
        },
        false
      ); //anonymous function() {exemptThisPage(0);} is necessary because exemptThisPage(0) on its own thinks I mean "the value returned from exemptThisPage(0)" and immediately fires the function to calculate that.
      aMain.innerHTML =
        "<li style='width:12px;text-align:center;display:block;cursor:pointer;font-size:9px;background:#FF0;position:fixed;z-index:999999999;border:1;bottom:0;right:0;color:#66ff00'>*</li>";
      observerEnable = false;
      document.body.appendChild(
        aMain
      ); /* did the above li need no ID? I guess not, but check this if something breaks. */
      observerEnable = true;
    }
logForDebugging("About to forEach theNodes",theNodes);
    theNodes.forEach(function(mutation) { 
       
        logForDebugging("forEach this node of TheNodes",mutation);
      if (HILIGHT_ELEMENTS_BEING_PROCESSED) {
        observerEnable = false; /* debugger; */
        mutation.target.style = 
          "border: 5px dotted rgba(200,200,200,1) !important; background:rgb(200,200,200) !important;" +
          mutation.target.style;
        $(mutation.target).data("highlighted", true);
        observerEnable = true;
      }

      logForDebugging(
        "OBSERVED: testing mutation: " +
          $(mutation.target).text().substr(0, 50),
        mutation.target
      );
      if (
        mutation.target.tagName != "BODY" ||
        $(document.body).data("firstrun") != thisSessionID
      ) {
        //just process the changed bits, not the whole body  more than once per session, ok?
        $(document.body).data("firstrun", thisSessionID);
        /* wcSetDebuggingAttributeSafely(mutation, "PassedAsMutationInSession" + thisSessionID, "true"); doesn't seem to be used anymore */
        logForDebugging(
          "Passing as mutation for session ID" + thisSessionID + ":",
          mutation
        );
          var theMutTargetText= $(mutation.target).text();
        if (
          --MAX_NUMBER_OF_CALLS_PER_PAGE > 0 &&
          !!theMutTargetText  &&
         ( theMutTargetText.match(theBadWordsAndFBNames) ) /* If we go back to scanning URL hrefs, this will have to be disabled, because it will need to check nodes even if bad terms are not in visible text. */
        ) {
          if (
            mutation.type != "attributes" ||
            mutation.attributeName == "hidden" ||
            1 == 1
          ) {
            /* ok, added 1 ==1 to disable because first I thought this would improve performance, but it resulted in some badwords not getting caught on http://abcnews.go.com/US/daughter-man-gunned-facebook-video-fear-fathers-eyes/story?id=46847374 . It's a good idea though, should figure out how to make it work... shouldn't trigger on every attribute change. */
            if (!$(document.body).data("FirstMutation")) {
              /* on the very first time this is called on a page, use the whole body to make sure everything gets checked once. */
              logForDebugging("First Mutation for page. passing Body.");
              $(document.body).data("FirstMutation", true);
              /* debugger; */
              main(-1, 5000, theDummy, thisSessionID);
            }
            if (HILIGHT_ELEMENTS_BEING_PROCESSED) {
              observerEnable = false; /* debugger; */
              mutation.target.style =
                "border: 5px solid rgba(100,100,100,1) !important; background:rgb(0100,100,100) !important;" +
                mutation.target.style;
              $(mutation.target).data("highlighted", true);
              observerEnable = true;
            }
            logForDebugging("About to call main.");
            /* debugger; */
            main(-1, 5000, mutation, thisSessionID);
          }
        } else {
          var theInnerText =
            theMutTargetText ||
            ""; /* otherwise the (match) line below causes a fatal error on no innertext */
          logForDebugging(
            "Ran too many times or no text or no match: (count) ",
            MAX_NUMBER_OF_CALLS_PER_PAGE
          );
          logForDebugging(
            "Ran too many times or no text or no match: (innerText) ",
            theInnerText
          );
          logForDebugging(
            "Ran too many times or no text or no match: (match) ",
            theInnerText.match(theBadFBNames)
          );
        }
        $("html,body").css("cursor", "auto");
      }
    });
    //restart observer
    /* document.mkObserverFlag = undefined; */
    observer.observe(document.body, {
      subtree: true,
      attributes: false,
      childList: true,
      characterData: true,
      attributeOldValue: false,
      characterDataOldValue: false
    });
  } // end if
});
// define what element should be observed by the observer
// and what types of mutations trigger the callback
observer.observe(document.body, {
  subtree: true,
  attributes: false,
  /*setting attributes to 'false' seemed to make script not always work on some changes, particularly on http://abcnews.go.com/US/daughter-man-gunned-facebook-video-fear-fathers-eyes/story?id=46847374 ... but working now, so disabled . */
  childList: true,
  characterData: true,
  attributeOldValue: false,
  characterDataOldValue: false
});
 
  main(-1, 5000, theDummy, "000");
  }

