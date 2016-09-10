  /*// IIFE - Immediately Invoked Function Expression
  (function(yourcode) {

    // The global jQuery object is passed as a parameter
  	yourcode(window.jQuery, window, document);

  }(function($, window, document) {

    // The $ is now locally scoped 

   // Listen for the jQuery ready event on the document
   $(function() {
     
     console.log('The DOM is ready');

     // The DOM is ready!

   });
    
    console.log('The DOM may not be ready');

   // The rest of code goes here!

  }));
*/
var schema_edit_mode = false;
var interaction_mode = "touch";
var touch_size = 50;
var mouse_size = 25;
var nodeId = 0;
var linkTypeId = 0;
var cur_size = 25;
var inspector_type = "inspector";
var nodeDescriptionElem;
var currentNodeType = "";
var currentLinkType = "";
var textInput = false;
var abbreviations = {"Proposition":"Prop.",
                     "Interpretive":"Interp.",
                     "Precondition":"Precon.",
                     "Referenced":"Ref.",
                     "Interpreted":"Interp.",
                     "Equivalent":"Equiv.","Damages":"Dmgs"};
var NodeTypes={}, LinkTypes={};
var currentTextElement=null;
var currentElementType="";
var elementLabel;

// Schema Variables
var local_schemas;
// Available set of schemas (server/local)
var schemas=[];
var in_schema = false;
var out_schema = false;
var schema_name = "DefaultSchema";
var schema_version = "0.0.0";
var currentSchemaId = -1;
var lastSchemaId = 0;
// Array of currently loaded schemas, serialized to local storage
var current_schemas = [];
var current_schema_location = "";

// Source Variables
var local_sources;
var current_sources = [];
var sources = [];
var lastSourceId = 0;

// Graph Variables
var local_graphs;
// Available set of graphs (server/local)
var graphs=[];
// Array of currently loaded graphs, serialized to local storage
var current_graphs = [];
var current_graphs_offsets = [];
var lastGraphId = 0;
var currentGraphId = -1;
var graph_name = "default graph";
var graph_version = "0.0.1";
var current_graph_location = "";

var operation_history = [];
var lastInputX = 0;
var lastInputY = 0;
var explanation = null;

var propertyTypes = {
  "Number":{
    typeValues:[
      {label:"Number",value:Number,defaultValue:0}
    ]
  },
  "String":{
    typeValues:[{label:"Content",type:String,defaultValue:""}]
  },
  "TextSpan":{
    typeValues:[{label:"srcID",value:String,defaultValue:0},
                {label:"beg",value:Number,defaultValue:0},
                {label:"end",value:Number,defaultValue:0}
               ]
  },
  "VideoSpan":{
    typeValues:[{label:"srcID",value:String,defaultValue:0},
                {label:"beg",value:"Timecode",defaultValue:0},
                {label:"end",value:"Timecode",defaultValue:0}
               ]
  }
}

var node_configuration = $("#node_configuration")[0];
var node_explanation = $("#node_type_explanation")[0];
var link_explanation = $("#link_explanation")[0];
var link_configuration = $("#link_configuration")[0];
can = document.getElementById("timeline");
ctx = can.getContext("2d");

// var propertyTypes = ["Number","String"];
// 
// set up initial nodes and links
//  - nodes are known by 'id', not by index in array.
//  - reflexive edges are indicated on the node (as a bold black circle).
//  - links are always source < target; edge directions are set by 'left' and 'right'.
var nodes = [
],
    lastNodeId = 0,
    links = [
    ],
    lastLinkId = 0,
    graph = {nodes:nodes,links:links};


// set up SVG for D3
var width  = window.innerWidth-180,
    height = window.innerHeight-300,
    colors = d3.scale.category20();

var sidebar = document.getElementById("left-panel");
sidebar.style.height = window.innerHeight + "px";
var centerpanel = document.getElementById("center-panel");
centerpanel.style.width = width + "px";
var svg = d3.select('#graph-container')
  .append('svg')
  .attr('class','canvas')
  .attr('oncontextmenu', 'return false;')
  .attr('width', width)
  .attr('height', height);
var source_panel = document.getElementById("source-panel");
source_panel.style.width=width+"px";

// init D3 force layout
var force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .gravity(0.1)
    .size([width, height])
    .linkDistance(150)
    .charge(-2000)
    .on('tick', tick),
    a = {type: "TE", x: 60, y: 3 * height / 6, fixed: true},
    b = {type: "P",  x: 1 * width / 3, y: 3 * height / 6, fixed: true},
    c = {type: "S",  x: 2 * width / 3, y: 3 * height / 6, fixed: true},
    d = {type: "T",  x: width-60, y: 3 * height / 6, fixed: true};
var forceNodes = force.nodes();
//forceNodes.push(a,b,c);

// define arrow markers for graph links
svg.append('svg:defs')
   .append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#FFF');

svg.append('svg:defs').append('svg:marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 4)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M10,-5L0,0L10,5')
    .attr('fill', '#FFF');

// line displayed when dragging new nodes
var drag_line = svg.append('svg:path')
  .attr('class', 'link dragline hidden')
  .attr('d', 'M0,0L0,0');

// handles to link and node element groups
var path = svg.append('svg:g').selectAll('path'),
    circle = svg.append('svg:g').selectAll('g');

// mouse event vars
var selected_node = null,
    selected_link = null,
    mousedown_link = null,
    mousedown_node = null,
    mouseup_node = null;

// Video and Canvas stuff
var can, ctx, canX, canY, mouseIsDown = 0;
var duration = 0;
var cursorTime = 0;
var curTime = 0;
var video;
var timeoutVariable;

$("#available_schemas").on("click", "label", function (e) {
    console.log("Clicked available schema");
    if (e.target.nodeName === "INPUT") {
        e.preventDefault();
        return;
}
    var control: HTMLInputElement = <HTMLInputElement>document.getElementById((<HTMLLabelElement>e.target).htmlFor);
    if (!$(e.target).hasClass('loaded')) {
        if (currentSchemaId != -1) {
            unload_schema(currentSchemaId);
        }
        if (control != null) {
            console.log("Loading schema " + control.value);
            import_schema(control.value, null);
        }
  } else {
    if($(e.target).hasClass('local'))
       console.log("Rename Schema")
    else
      unload_schema(e.target.id.substr(12));
  }
});
console.log("Adding event handler...");
$("#available_graphs").on("click", "label", function (e) {
    if (e.target.nodeName === "INPUT") {
        e.preventDefault();
        return;
    }
    var control: HTMLInputElement = <HTMLInputElement>document.getElementById((<HTMLLabelElement>e.target).htmlFor);
  if(!$(e.target).hasClass('loaded')) {
    // unload any currently loaded graphs.
    if(currentGraphId!=-1)
          unload_graph(currentGraphId);
    if (control != null)
        import_graph(control.value);
  } else {
    if($(e.target).hasClass('local'))
       console.log("Rename Graph")
    else
      unload_graph(e.target.id.substr(11));
  }
});
$("#save_file").click(function(){saveToFile($("#json_output").text(),undefined)});
$("#load_content").click(function(){
  var response = jQuery.parseJSON($("#json_input").val());
  if(response.schema){
    import_schema(response.schema,null);
  }
  import_graph_content(response);
});

$("#deleteSchema").click(function(){
  console.log("Clicked DeleteSchema");
  if(currentSchemaId != -1 && $("#schemaLabel-"+currentSchemaId).hasClass('local')) {
    for(var i in local_graphs) {
      if(local_graphs[i].schemaId = currentSchemaId) {
        console.log("Delete Graphs First");
        return;
      }
      unload_schema(currentSchemaId);
    }
    var tempSchemaId = currentSchemaId;
    for(var i in local_schemas) {
      if(local_schemas[i].schemaId === tempSchemaId) {
        local_schemas.splice(local_schemas[i],1);
        schemas.splice(local_schemas[i],1);
        console.log("Deleting schema " + tempSchemaId);
        window.localStorage.setItem("local_schemas",JSON.stringify(local_schemas));
        $("#schemaLabel-"+tempSchemaId).remove();
      }
    }
  }
});

$("#deleteGraph").click(function(){
  if(currentGraphId != -1 && $("#graphLabel-"+currentGraphId).hasClass('local')) {
    var tempGraphId = currentGraphId;
    unload_graph(tempGraphId);
    for(var i in local_graphs) {
      if(local_graphs[i].graphId === tempGraphId) {
        local_graphs.splice(local_graphs[i],1);
        schemas.splice(local_graphs[i],1);
        console.log("Deleting schema " + tempGraphId);
        window.localStorage.setItem("local_graphs",JSON.stringify(local_graphs));
        $("#graphLabel-"+tempGraphId).remove();
      }
    }
  }
});

$("#createGraph").click(function(){
  if(currentSchemaId === -1) {
    console.log("No schema loaded, can't create graph");
    return;
  }
  if(current_graphs.length>0 && currentGraphId!=-1) {
    unload_graph(currentGraphId);
  }
  var graphId = ++lastGraphId;
  window.localStorage.setItem("lastGraphId", lastGraphId.toString());
  graph_version = "0.0.0";
  graph_name = "Graph " + graphId;
  lastNodeId = 0;
  lastLinkId = 0;
  currentGraphId = graphId;
  var input = document.createElement("input");
  input.id = "graph-" + graphId;
  input.value = "graph_" + graphId + ".json";
  input.style.display = "none";
  var element = document.createElement("label");
  element.className="graphLabel local";
  element.className += " loaded";
  element.htmlFor = "graph-" + graphId;
  element.innerHTML = "Graph " + graphId;
  element.appendChild(input);
  $(element).insertBefore($("#available_graphs>.buttons"));
  current_graph_location = "graph_"+graphId+".json";
  current_graphs =  [{name:graph_name,
                      graphId:currentGraphId,
                      file:current_graph_location,
                      type:"semantic_graph",
                      schema:current_schema_location,
                      schemaVersion:schema_version,
                      schemaId:currentSchemaId,
                      version:graph_version,
                      nodes:nodes,
                      links:links}];
  window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
  local_graphs.push(current_graphs[0]);
  window.localStorage.setItem("local_graphs",JSON.stringify(local_graphs));
  graphs.push(current_graphs[0]);
});
$("#createSchema").click(function(){
  // For the moment, only allow one schema at a time.
  console.log("Creating schema...");
  if(current_schemas.length>0 && currentSchemaId!=-1) {
    unload_schema(currentSchemaId);
  }
  currentSchemaId = ++lastSchemaId;
  lastNodeId = -1;
  nodeId = 0;
  lastLinkId = -1;
  window.localStorage.setItem("lastSchemaId", lastSchemaId.toString());
  schema_version = "0.0.0";
  schema_name = "Schema " + currentSchemaId;
  currentSchemaId = currentSchemaId;
  var input = document.createElement("input");
  input.value = "schema-" + currentSchemaId + ".json";
  input.id = "schemaLabel-" + (currentSchemaId);
    input.style.display = "none";
  var element = document.createElement("label");
  element.className="schemaLabel local";
  element.className+=" loaded";
  element.htmlFor = "schemaLabel-"+(currentSchemaId);
  element.innerHTML = "Schema " + currentSchemaId;
  element.appendChild(input);
  $(element).insertBefore("#available_schemas>.buttons");
  current_schema_location = "schema-" + currentSchemaId + ".json";
  current_schemas =  [{name:schema_name,
                       type:"schema",
                       file:current_schema_location,
                       schemaId:currentSchemaId,
                       version:schema_version,
                       nodeTypes:NodeTypes,
                       linkTypes:LinkTypes}];
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
  local_schemas.push(current_schemas[0]);
  window.localStorage.setItem("local_schemas",JSON.stringify(local_schemas));
  schemas.push(current_schemas[0]);
});
$("#save_json").click(saveJson);
$("#inspector_container").on('change','#text-content',function(e){
});
$("#inspector_container").on('focusin','#text-content',function() {
  textInput=true;
  currentTextElement = $("#text-content")[0];
})
$("#node_properties").on("focusin",'.node_property_row_value',function(e) {
  textInput=true;
  currentTextElement = $(this)[0];
});
$("#nodes").on("focusin",'.node_type_property_default',function(e) {
  textInput=true;
  currentTextElement = $(this);
});
$("#text-content").focusout(function() {
  textInput=false;
});
$("#elementHeader").click(function() {
  $("#elements").toggle();
});
$("timelineHeader").click(function() {
  $("#timelines").toggle();
});
$("#schemaHeader").click(function(e){
  if(e.target.id!=="createSchema"&& e.target.id!=="deleteSchema") {
    // Should probably warn against deleting Schema with Graphs.
    $("#available_schemas label").not('.loaded').toggle();
    $("#available_schemas .buttons").toggle();
    $("#schemaHeader").toggleClass("folded");
  }
});
$("#graphHeader").click(function(e){
  if(e.target.id!=="createGraph"&& e.target.id!=="deleteGraph") {
    $("#available_graphs label").not('.loaded').toggle();
    $("#available_graphs .buttons").toggle();
    $("#graphHeader").toggleClass("folded");
  }
});
console.log("Adding node header handler");
console.log($("#nodeHeader"));
$("#node_selection div.header").click(function (e) {
    console.log("Clicked header");
  if(e.target.id!=="createNodeType") {
    $("#nodes").toggle();
    $("#node_selection .addButton").toggle();
    $("#node_selection div.header").toggleClass("folded");
    $(node_configuration).toggle();
  }
});
$("#link_selection div.header").click(function(e){
  if(e.target.id!=="createLinkType") {
    $("#links").toggle();
    $("#link_selection .addButton").toggle();
    $("#link_configuration").toggle();
    $("#link_selection div.header").toggleClass("folded");
  }
});

function import_graph_content(data) {
  // Check if current graph has already been loaded
  for (var i in current_graphs) {
    if(data.name==current_graphs[i].name && data.version == current_graphs[i].version) {
      return;
    }
  }
  // If it hasn't, make it the current graph
  current_graphs = [data];
  current_graph_location = data.file;
  // Set the button loaded class
  var found = false;
  for(i in graphs) {
    if(graphs[i].name===data.name && graphs[i].version===data.version) {
      currentGraphId = data.graphId;
      graphs[i].graphId=data.graphId;
      $("#graphLabel-"+currentGraphId).parent().addClass("loaded");
      found = true;
      break;
    }
  }

  // This isn't in graphs -- add it.
  if(!found) {
    console.log("Adding new graph");
    console.log(data);
    graphs.push(data);
    currentGraphId = data.graphId;
    var input = document.createElement("input");
    input.id = "graphLabel-" + (data.graphId);
    input.value ="graph_"+data.graphId+".json";
    var element = document.createElement("label");
    element.className="graphLabel";
    element.className += " loaded";
    element.htmlFor = "graphLabel-"+(data.graphId);
    element.innerHTML = "Graph " + data.graphId;
    element.appendChild(input);
    $("#available_graphs").append(element);
    console.log("Finished adding new graph");
  }
  lastGraphId=graphs.length-1;

  var tempNodes = data.nodes;
  lastNodeId=0;
  for (var node in tempNodes) {
    nodes.push(tempNodes[node]);
    lastNodeId = tempNodes[node].id;
    }
  current_graphs[0].nodes=nodes;
  lastLinkId = 0;
  var tempLinks = data.links;
  for (var link in tempLinks) {
    var candidate_link = tempLinks[link]
    lastLinkId = tempLinks[link].id;
    for(i = 0; i < nodes.length; i++) {
      if(nodes[i].id === candidate_link.source.id)
        candidate_link.source = nodes[i];
      if(nodes[i].id === candidate_link.target.id)
        candidate_link.target = nodes[i];
    }
    links.push(candidate_link);
  }
  current_graphs[0].links=links;
  // init D3 force layout
  restart();
  outputSchemaGraph();
  window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
}

function import_graph(graph_location) {
  // Unload any current schemas to be safe.
  if(currentSchemaId!=-1)
    unload_schema(currentSchemaId);
  for(var i in local_graphs) {
    if(local_graphs[i].file===graph_location) {
      if(local_graphs[i].schema) {
        import_schema(local_graphs[i].schema,function() {import_graph_content(local_graphs[i])});
        return;
      }
      import_graph_content(local_graphs[i]);
      return;
    }
  }


  $.getJSON(graph_location, function (data) {
    if(typeof data==="object")
    {
      if(data.type==="schema") {
        import_schema_content(data,undefined);
      } else if (data.type==="semantic_graph") {
        if(data.schema){
          import_schema(data.schema,function() {import_graph_content(data)});
        } else 
          import_graph_content(data);
      }
    }
  });
}

function import_schema_content(data,onComplete) {
  // Set the button loaded class
  for(var i in schemas) {
      if (schemas[i].name === data.name && schemas[i].version === data.version) {
          $("#schemaLabel-" + data.schemaId).parent().addClass("loaded");
    }
  }

  // Check if current graph has already been loaded
  for (i in current_schemas) {
    if(data.name==current_schemas[i].name && data.version == current_schemas[i].version) {
      if(onComplete!=undefined)
        onComplete();
      currentSchemaId=current_schemas[i].schemaId;
      return;
    }
  }
  current_schemas.push(data);
  currentSchemaId=data.schemaId;
  current_schema_location = data.file;
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
  schema_name = data.name;
  schema_version = data.version;
  NodeTypes = data.nodeTypes;
  // Populate the node options
  i = 0;
  var newgroup = $("#nodes");
    $("#nodes label").remove()
    for(var key in NodeTypes){
      NodeTypes[key].id = nodeId++;
      var label = document.createElement("label");
      label.className = "toggle-btn symbol";
      var circleSvg = document.createElement("svg");
      $(circleSvg).attr("width",30);
      $(circleSvg).attr("height",30);
      $(circleSvg).addClass("node");
      $(circleSvg).addClass("labelNode");
      var circleNode = document.createElement("circle");
      $(circleNode).attr("r",15);
      $(circleNode).attr("cx",15);
      $(circleNode).attr("cy",15);
      $(circleNode).attr("fill",d3.rgb(colors(NodeTypes[key].id)).toString());
      $(circleSvg).append($(circleNode));
      //$(label).css("background-color",d3.rgb(colors(NodeTypes[key].id)).toString());
      var input = document.createElement("input");
      input.value=key;
      input.name="elements";
      input.type="radio";
      $(input).addClass("visuallyhidden");
      $(newgroup).append(label)
      $(label).append(input);
      var nameAbbrev = NodeTypes[key].name;
      for (var name in abbreviations) {
        nameAbbrev = nameAbbrev.replace(name,abbreviations[name]);
      }
      var span = document.createElement("span");
      span.id="label"+key;
      span.innerHTML = nameAbbrev;
      $(label).append($(span));
      $(label).append($(circleSvg));
      label.innerHTML+="";
      i++;
    }
    nodeId = i;
    newgroup.append(node_configuration);
    
    LinkTypes = data.linkTypes;
    // Populate the node options
    var j = 0;
    newgroup = $("#links");
    $("#links label").not("#link_configuration label").remove();
    for(var key in LinkTypes){
      LinkTypes[key].id = linkTypeId++;
      var label = document.createElement("label");
      label.className = "toggle-btn symbol";
      //$(label).css("background-color",d3.rgb(colors(LinkTypes[key].id)).toString());
      var input = document.createElement("input");
      input.value=key;
      input.name="elements";
      input.type="radio";
      $(input).addClass("visuallyhidden");
      $(label).append(input);
      var span = document.createElement("span");
      span.id="label"+key;
      span.innerHTML = LinkTypes[key].name;
      $(label).append($(span));
      label.innerHTML+="";
      $(newgroup).append(label)
      j++;
    }
  newgroup.append(link_configuration);
  updateValidNodes();
  outputSchemaGraph();
  if(onComplete!=undefined)
    onComplete();
}

function import_schema(schema_location,onComplete) {
  for(var i in local_schemas) {
    if(local_schemas[i].file===schema_location) {
      import_schema_content(local_schemas[i],onComplete);
      return;
    }
  }
  $.getJSON(schema_location, function (data) {
    import_schema_content(data,onComplete);
  });
}

function unload_graph(graphId){
  // TODO: Unload the graph
  // Remove all nodes from the set of nodes
  var sourceNodes = current_graphs[0].nodes;
  var newArray = [];
  for(var curNode=nodes.length-1; curNode >= 0; curNode--) {
    for(var node in sourceNodes) {
      if(sourceNodes[node].id===nodes[curNode].id) {
        nodes.splice(curNode, 1);
        spliceLinksForNode(nodes[curNode]);
        break;
      }
    }
  }
  //re-assign node ids
  var sourceLinks = current_graphs[0].links;
  for(var curLink = links.length-1; curLink>=0; curLink--) {
    for(var link in sourceLinks) {
      if(sourceLinks[link].id===links[curLink].id) {
        links.splice(curLink, 1);
        break;
      }
    }
  }
  // remake link ids
  restart();
  // Remove all links from the set of links
  currentGraphId = -1;
  $("#graphLabel-"+graphId).parent().removeClass("loaded");
  current_graphs.splice(0,1);
  window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
}

function unload_schema(schemaId) {
  // First, unload any graph that is currently using this schema
  for (var i in current_graphs) {
    if(current_graphs[i].schemaId == schemaId) {
      unload_graph(current_graphs[i].graphId);
    }
  }
  for (var j in NodeTypes) {
    $("#nodes>label>input[value='"+j+"']").parent().remove();
    delete NodeTypes[j];
  }
  for (var k in LinkTypes) {
    $("#links>label>input[value='"+k+"']").parent().remove();
    delete LinkTypes[k];
  }
  restart();
  $("#schemaLabel-"+schemaId).parent().removeClass("loaded");
  current_schemas.splice(0,1);
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
  currentSchemaId = -1;
}

function videoLoaded(e) {
  duration = e.target.duration;
  showTime(ctx, can, cursorTime, curTime, duration);
}

function extractTime(timeString) {
  var components = timeString.split(":");
  return 60 * parseInt(components[0], 10) + parseInt(components[1], 10) + parseInt(components[2], 10) / 30;
}

function showTimestamp(ctx, can, time, color, ht, offset) {
  ctx.font = "12pt Helvetica";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = color;
  // draw text at center, max length to fit on canvas
  ctx.fillText(padTime(time), can.width / 2, ht * can.height + offset, can.width - 10);
    }

function padTime(timeNum) {
  return padNumber((Math.floor(timeNum / 60))) + ":" + padNumber(Math.floor(timeNum) % 60) + ":" + padNumber((Math.floor((timeNum - Math.floor(timeNum)) * 30.0)));
}

function padNumber(timeIn) {
  if (timeIn < 10) {
    return "0" + timeIn;
  } else {
    return timeIn;
  }
}

function showTime(ctx, can, cursorTime, curTime, duration) {
  var x = 0, y = null, begin, end, selected;
  ctx.clearRect(0, 0, can.width, can.height);
  showTimestamp(ctx, can, cursorTime, "rgb(255,64,64)", 0.25, 10);
  showTimestamp(ctx, can, curTime, "rgb(64,255,64)", 0.75, 0);
  ctx.textAlign = "left";

  var accumulatedTime = 0;
/*  for (y in line_list) {
    if (line_list.hasOwnProperty(y)) {
      begin = extractTime(line_list[y].begin);
      end = extractTime(line_list[y].end);
      selected = ((cursorTime >= begin && cursorTime <= end) || (curTime >= begin && curTime <= end));
      drawLine(begin, end - begin, selected, line_list[y], duration, ctx, can);
      // Detect current shot
    }
  }*/
  ctx.textAlign = "left";
  showCursor(cursorTime, duration, "green", can, ctx);
  showCursor(curTime, duration, "red", can, ctx);
}

function showCursor(start, total_length, color, can, ctx) {
  ctx.beginPath();
  ctx.rect((start / total_length) * can.width - 1, 0, 2, 100);
  ctx.fillStyle = color;
  ctx.fill();
}

$.getJSON("/index.json", function (data) {
  for(var i in data.schemas) {
    schemas.push(data.schemas[i]);
  }
  for(var j in data.graphs) {
    graphs.push(data.graphs[j]);
  }
  for(var k in data.sources) {
    sources.push(data.sources[k]);
  }

  for (var source in data.sources) {
    if(data.sources[source].type === "mp4") {
      // Load the video
      video = document.createElement("video");
      video.id="myVideo";
      video.setAttribute("crossorigin","null");
      video.setAttribute("type","video/mp4");
      video.setAttribute("controls","");
      video.src = data.sources[source].file;
      video.addEventListener('loadeddata', videoLoaded, false);
      video.load();
      $("#available_sources").append(video);
      var can: HTMLCanvasElement = <HTMLCanvasElement>$("#timeline").get(0);
      can.width = $('#available_sources').innerWidth();
      can.height = 100;
      can.addEventListener("mousedown", mouseDown, false);
      can.addEventListener("mousemove", mouseXY, false);
      video.addEventListener('play', playVideo, false);
      video.addEventListener('pause', pauseVideo, false);
        function pauseVideo(e) {
            curTime = video.currentTime;
            window.clearTimeout(timeoutVariable);
        }


        function changeTimecode(e) {
        }

        function playVideo(e) {
          var i = 0;
          curTime = video.currentTime;
          timeoutVariable = setInterval(myFunction, 1000.0 / 30.0);
        }

        var input: HTMLInputElement = document.createElement("input");
        input.id = "sourceLabel-" + data.sources[source].sourceId;
        input.value = data.sources[source].file;
        var element: HTMLLabelElement = <HTMLLabelElement>document.createElement("label");
        element.htmlFor = "sourceLabel-" + data.sources[source].sourceId;
        element.className = "sourceLabel";
        element.appendChild(input);
      // check if schema has already been loaded
      for (i in current_sources) {
        if(current_sources[i].name===data.sources[source].name && current_sources[i].sourceId===data.sources[source].sourceId) {
          element.className+=" loaded";
        }
      }
      element.innerHTML = data.sources[source].name;
      //$("#available_sources").append(element);
    }
  }

  for (var schema in data.schemas) {
      var input = document.createElement("input");
      input.id = "schemaLabel-" + data.schemas[schema].schemaId;
      input.value = data.schemas[schema].file;
      input.style.display = "none";
      var element = document.createElement("label");
      element.htmlFor = "schemaLabel-" + data.schemas[schema].schemaId;
      lastSchemaId = Math.max(data.schemas[parseInt(schema)].schemaId, lastSchemaId);
      window.localStorage.setItem("lastSchemaId", lastSchemaId.toString() );
      element.className = "schemaLabel";
    // check if schema has already been loaded
    for (var i in current_schemas) {
      if(current_schemas[i].name===data.schemas[schema].name && current_schemas[i].version===data.schemas[schema].version) {
        element.className+=" loaded";
      }
    }
    element.innerHTML = data.schemas[schema].name;
    element.appendChild(input);
    if ($("#available_schemas label.local").length != 0) {
      $(element).insertBefore($("#available_schemas label.local")[0]);
    } else {
      $(element).insertBefore("#available_schemas>.buttons");
      }

  }
  for (var graph in data.graphs) {
      var input = document.createElement("input");
      input.id = "graphLabel-" + data.graphs[graph].graphId;
      input.value = data.graphs[graph].file;
      input.style.display = "none";
      var element = document.createElement("label");
      element.htmlFor = "graphLabel-" + data.graphs[graph].graphId;
    lastGraphId = Math.max(data.graphs[graph].graphId, lastGraphId);
    window.localStorage.setItem("lastGraphId", lastGraphId.toString());
    element.className="graphLabel";
    for (i in current_graphs) {
      if(current_graphs[i].name===data.graphs[graph].name && current_graphs[i].version===data.graphs[graph].version) {
        element.className+=" loaded";
      }
    }
    element.innerHTML = data.graphs[graph].name;
    element.appendChild(input);
    if($("#available_graphs label.local").length!=0) {
      $(element).insertBefore($("#available_graphs label.local")[0]);
    } else {
      $(element).insertBefore("#available_graphs>.buttons");
    }
  }
});

function setSchemaEditMode(enabled) {
    if (enabled) {
        console.log("Schema edit mode enabled");
    // Add hooks to edit description and name.
    $("#nodes").on("click", ".node_type_property_name", editNodePropertyName);
    $("#nodes").on("click", "#node_type_explanation", editNodeDescription);
    $("#nodes .buttons").on("click", "#createNodeTypeProperty", createNodeTypeProperty);
    $("#links").on("click","#link_type_explanation", editLinkDescription);
    $("#nodes").on("click", "input", inputChange);
    $("#links").on("click", "input", inputChange);
    $("#nodes").on('change','select.node_type_property_type',nodeTypePropertyTypeChange);
    $("#validLeftNodes").on("change","",leftNodesChanged);
    $("#validRightNodes").on("change","",rightNodesChanged);
    schema_edit_mode = true;
  }
}

function generateNodeTypePropertyValue(propertyId, valueId, propertyTypeValue,newValue) {
    var propDiv = document.createElement("div");
    propDiv.className = "propertyTypeValue";
    var label = document.createElement("label");
    label.innerHTML = propertyTypeValue.label;
    $(propDiv).append(label);
    var value = document.createElement("input")

  if(value===undefined) {
    value.className = "node_type_property_default";
    value.value=propertyTypeValue.defaultValue;
    if(propertyTypeValue.value=="Timecode") {
      value.value="00:00:00";
      }
  } else {
    value.value=newValue;
    value.className = "node_property_row_value";
    if(propertyTypeValue.value=="Timecode") {
      value.value=      padTime(newValue);
     }
}
  value.id = "property-value-" + propertyId + "-" + valueId;
  value.type = "text";
  value.name = propertyId;
  $(propDiv).append(value);
  return propDiv;
}

// Handler for when the node type property type changes
function nodeTypePropertyTypeChange(e) {
  var propId=e.target.parentElement.id.substr(5);
  var nodeProperty = NodeTypes[currentNodeType].properties[propId];
  nodeProperty.type = e.target.selectedOptions[0].value;
  var property_line =   $(e.target.parentElement);
  $("#"+e.target.parentElement.id+">.propertyTypeValue").remove();
  if(propertyTypes[nodeProperty.type].typeValues.length>1)
    $(property_line).append(document.createElement("br"));
  nodeProperty.typeValues = [];
  for(var j in propertyTypes[nodeProperty.type].typeValues) {
    $(property_line).append(
      generateNodeTypePropertyValue(nodeProperty.id, j, 
                                    propertyTypes[nodeProperty.type].typeValues[j],null));
    nodeProperty.typeValues[j] = propertyTypes[nodeProperty.type].typeValues[j].defaultValue;
  }
  NodeTypes[currentNodeType].properties[propId] = nodeProperty;
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
}

// This takes a textInput and saves the content both in the graph and
// in the DOM
function commitText(e){
  var textId = currentTextElement.id;
  if (textId.substr(0,14)==="property-value") {
    var ids = textId.split("-");
    console.log("Committing property value");
    console.log(ids);
    selected_node.properties[ids[2]][ids[3]] = $(currentTextElement).val();
    var redacted_node = {id:selected_node.id,
                           reflexive:selected_node.reflexive,
                           type:selected_node.type
                          }
    $("#inspector pre").html(JSON.stringify(redacted_node,null,2));
    outputSchemaGraph();
    window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
  } else if (textId.substr(0,5) ==="prop-") {
    NodeTypes[currentNodeType].properties[textId.substr(5)].defaultValue = $(currentTextElement).val();
  } else {
    if(textId === "node_name_input") {
      NodeTypes[currentNodeType].name = $(currentTextElement).val();
      $("#label"+currentElementType).html($(currentTextElement).val());
      explanation.html($(currentTextElement).val());
      window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
    } else if (textId === "node_property_name_input") {
      NodeTypes[currentNodeType].properties[currentTextElement.parentElement.id.substr(5)].name=$(currentTextElement).val();
      explanation.html($(currentTextElement).val());
      window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
    } else if (textId === "node_explanation_input") {
      NodeTypes[currentNodeType].description = $(currentTextElement).val();
      explanation.html($(currentTextElement).val());
      window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
    } else if (textId === "link_name_input") {
      LinkTypes[currentLinkType].name = $(currentTextElement).val();
      $("#label"+currentElementType).html($(currentTextElement).val());
      explanation.html($(currentTextElement).val());
      window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
    } else if (textId === "link_explanation_input") {
      LinkTypes[currentLinkType].description = $(currentTextElement).val();
      explanation.html($(currentTextElement).val());
      window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
    } 
    $(currentTextElement).replaceWith(explanation);
  }
  textInput=false;
  outputSchemaGraph();
  updateValidNodes();
}

function editNodePropertyValue(e) {
  textInput=true;
}

function editNodePropertyName(e) {
  explanation = $(e.target);
  var inputBox = document.createElement("textarea");
  inputBox.className = "EditNodeTypePropertyName";
  inputBox.value = NodeTypes[currentNodeType].properties[e.target.parentElement.id.substr(5)].name;
  inputBox.id = "node_property_name_input";
  inputBox.setAttribute("rows","1");
  inputBox.style.width = explanation.innerWidth();

  $(explanation).replaceWith($(inputBox));
  inputBox.focus();
  inputBox.setSelectionRange(0,inputBox.value.length);
  currentTextElement = inputBox;
  textInput=true;
  currentElementType = currentNodeType;
  $(inputBox).focusout(commitText);

}

function editNodeDescription(e) {
  // Turn the description into an input box and insert text of current
  // description there.
  var inputBox = document.createElement("textarea");
  inputBox.value = NodeTypes[currentNodeType].description;
  inputBox.id = "node_explanation_input";
  explanation = $(node_explanation);
  $(explanation).replaceWith($(inputBox));
  inputBox.focus();
  inputBox.setSelectionRange(0,inputBox.value.length);
  currentTextElement = inputBox;
  textInput=true;
  currentElementType = currentNodeType;
  $(inputBox).focusout(commitText);
}

function editLinkDescription(e) {
  // Turn the description into an input box and insert text of current
  // description there.
  var inputBox = document.createElement("textarea");
  inputBox.value = LinkTypes[currentLinkType].description;
  inputBox.id = "link_explanation_input";
  explanation = node_explanation;
  $(explanation).replaceWith($(inputBox));
  inputBox.focus();
  inputBox.setSelectionRange(0,inputBox.value.length);
  currentTextElement = inputBox;
  currentElementType = currentLinkType;
  textInput=true;
  $(inputBox).focusout(commitText);
}

var curState = 0;

// Handle things differently based on whether we are in schema edit mode or not.
// This function specifically handles the mouse events of Node Types and Link Types.
// It uses their ancestor id (#nodes or #links)
var inputChange = function (e) {
    console.log("InputChange");
  if( $(this).attr("name") ) {
    var selector = "input[name='"+$(this).attr("name")+"']";
    if($(this).parent().hasClass("success") && !textInput && $(this).attr("name")==="elements") {
      if(e.clientX===lastInputX && e.clientY===lastInputY) {
        var inputBox = document.createElement("input");
        inputBox.type = "text";
        if($(this).attr("name")==="nodes"|| $(this).parent().parent().attr("id")==="nodes") { 
          inputBox.value = NodeTypes[currentNodeType].name;
          inputBox.id = "node_name_input";
          nodeDescriptionElem = $("#label"+currentNodeType);
          currentElementType = currentNodeType;
          currentLinkType = "";
        } else if ($(this).attr("name")==="links"|| $(this).parent().parent().attr("id")==="links") {
          inputBox.value = LinkTypes[currentLinkType].name;
          inputBox.id = "link_name_input";
          nodeDescriptionElem = $("#label"+currentLinkType);
          currentElementType = currentLinkType;
          currentNodeType = "";
        }
        nodeDescriptionElem.replaceWith($(inputBox));
        explanation=nodeDescriptionElem;
        inputBox.focus();
        inputBox.setSelectionRange(0,inputBox.value.length);
        currentTextElement = inputBox;
        textInput=true;
        $(inputBox).focusout(commitText);
      } else {
        lastInputX = e.clientX;
        lastInputY = e.clientY;
      }
    }
    if(!textInput) {
      $(selector).parent().removeClass("success");
      $(this).parent().addClass("success");

      if($(this).attr("name")==="nodes"|| $(this).parent().parent().attr("id")==="nodes") {
        $(node_explanation).html(NodeTypes[$(this).attr("value")].description);
        $(node_configuration).insertAfter($(this).parent());
        $(".node_type_property").remove();
        for(var i in NodeTypes[$(this).attr("value")].properties) {
          var property_line = generateNodeTypeProperty(NodeTypes[$(this).attr("value")].properties[i],true);
          $("#node_type_properties").append(property_line);
        }
        $(node_configuration).show();
        $(link_configuration).hide();
      } else if ($(this).attr("name")==="links"|| $(this).parent().parent().attr("id")==="links") {
        $($(link_explanation).html(LinkTypes[$(this).attr("value")].description));
        $(link_configuration).insertAfter($(this).parent());
        $("#validLeftNodes option").each(function(){
          $(this).prop("selected",false);
        });
        $("#validRightNodes option").each(function(){
          $(this).prop("selected",false);
        });
        if(LinkTypes[$(this).attr("value")].homogeneous!=undefined) {
          $("#link_homogeneous").prop("checked",LinkTypes[$(this).attr("value")].homogeneous);
        } else if (LinkTypes[$(this).attr("value")].homogeneous===undefined){
          $("#link_homogeneous").prop("checked",false);
          LinkTypes[$(this).attr("value")].homogeneous = false;
        }
        for(var leftSideIndex in LinkTypes[$(this).attr("value")].left_nodes){
          $("#validLeftNodes option[value='"+LinkTypes[$(this).attr("value")].left_nodes[leftSideIndex]+"']").prop("selected",true);
        }
        for(var rightSideIndex in LinkTypes[$(this).attr("value")].right_nodes){
          $("#validRightNodes option[value='"+LinkTypes[$(this).attr("value")].right_nodes[rightSideIndex]+"']").prop("selected",true);
        }
        $(node_configuration).hide();
        $(link_configuration).show();

      } else if($(this).attr("name")==="in_schema_graph"|| $(this).parent().parent().parent().attr("id")==="in_schema_graph") {
        // Handle selection of either graph or schema for input.
        if($(this).attr("value") == "in_schema") {
  in_schema = true;
        } else if ($(this).attr("value") == "in_graph"){
          in_schema = false;
        }
      } else if($(this).attr("name")==="out_schema_graph"|| $(this).parent().parent().parent().attr("id")==="out_schema_graph") {
        // Handle selection of either graph or schema for input.
        if($(this).attr("value") == "out_schema") {
          out_schema = true;
        } else if ($(this).attr("value") == "out_graph"){
          out_schema = false;
        }
        outputSchemaGraph();
      }
      if($(this).attr("name") === "nodes" || $(this).parent().parent().attr("id")==="nodes") {
        currentLinkType = "";
        currentNodeType = $(this).attr("value");
      } else if ($(this).attr("name") === "links" || $(this).parent().parent().attr("id")==="links") {
        currentNodeType = "";
        currentLinkType = $(this).attr("value");
      } else if ($(this).attr("name") === "auxiliary") {
        $(".inspector_div").not("#"+$(this).attr("value")).hide();
        $("#"+$(this).attr("value")).toggle();
      }
    }
  } else {
    $(this).parent().toggleClass("success");
  }
}

$(".toggle-btn:not('.noscript') input[type=radio]").addClass("visuallyhidden");
$(".toggle-btn:not('.noscript') input[type=radio]").click(inputChange);

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

// update force layout (called automatically each iteration)
function tick(e: d3.layout.force.Event) {
  var k = e.alpha;

  forceNodes.forEach(function(node) {
    if (node['type'] === "TE") {
      node.x = a.x;
    }
    if (node['type'] === "P" || node['type'] === "I" || node['type'] === "G" || node['type'] === "A" || node['type'] === "B") {
      node.x += (b.x - node.x) * k;
    }
    else if (node['type'] === "S") {
      node.x = c.x;
    }
    else if (node['type'] === "T") {
      node.x = d.x;
      // Add timelines if necessary here.
    }
  });
  // draw directed edges with proper padding from node centers
  path.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = d.left ? cur_size+4 : cur_size,
        targetPadding = d.right ? cur_size+4 : cur_size,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  circle.attr('transform', function(d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });
}

// update graph (called when needed)
function restart() {
    // path (link) group
    path = path.data(links);

  // update existing links
  path.classed('selected', function(d) { return d === selected_link; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; });


  // add new links
  path['enter']().append('svg:path')
    .attr('class', 'link')
    .classed('selected', function(d) { return d === selected_link; })
    .classed('f', function(d) { return d.type === 'f'; })
    .classed('ia', function(d) { return d.type === 'ia'; })
    .classed('ba', function(d) { return d.type === 'ba'; })
    .classed('ea', function(d) { return d.type === 'ea'; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; })
      .on('mousedown', function (d) {
          var keyboardEvent: d3.BaseEvent = d3.event;
      if(keyboardEvent['ctrlKey']) return;

      // select link
      mousedown_link = d;
      if(mousedown_link === selected_link) selected_link = null;
      else selected_link = mousedown_link;
      selected_node = null;
      $("#inspector h3").html("Link Selected");
      var redacted_link = {id:selected_link.id,
                           type:selected_link.type,
                           left:selected_link.left,
                           right:selected_link.right,
                           source:{id:selected_link.source.id,
                                   type:selected_link.source.type,
                                   type_id:selected_link.source.type_id
                                  },
                           target:{id:selected_link.target.id,
                                   type:selected_link.target.type,
                                   type_id:selected_link.target.type_id}
                          };
      $("#inspector pre").html(JSON.stringify(redacted_link,null,2));
      $("#inspector textarea").remove();
      restart();
    });

  // remove old links
  path['exit']().remove();


  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, function(d) { return d.id; });

  // update existing nodes (reflexive & selected visual states)
  circle.selectAll('circle')
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.type_id)).brighter().toString() : colors(d.type_id); })
    .classed('reflexive', function(d) { return d.reflexive; });

  // add new nodes
  var g = circle['enter']().append('svg:g');

  g.append('svg:circle')
    .attr('class', 'node')
    .attr('r', cur_size)
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.type_id)).brighter().toString() : colors(d.type_id); })
    .style('stroke', function(d) { return d3.rgb(colors(d.type_id)).darker().toString(); })
    .classed('reflexive', function(d) { return d.reflexive; })
    .on('mouseover', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // enlarge target node
      d3.select(this).attr('transform', 'scale(1.1)');
    })
    .on('mouseout', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // unenlarge target node
      d3.select(this).attr('transform', '');
    })
  .on('touchstart', function(d) {
  })
    .on('mousedown', function(d) {
      if(d3.event['ctrlKey']) return;

      // select node
      mousedown_node = d;
      if(mousedown_node === selected_node) selected_node = null;
      else selected_node = mousedown_node;
      if(selected_node != null) {
        $("#inspector").show();
        $("#node_properties div").remove();
        if(NodeTypes[selected_node.type].hasOwnProperty("properties") && NodeTypes[selected_node.type].properties.length>0) {
          $("#properties_label").show();
          if(selected_node.properties===undefined)
            selected_node.properties=[];
          for (var prop in NodeTypes[selected_node.type].properties) {
            var propDiv = document.createElement("div");
            propDiv.className="node_property_value_row";
            if(propertyTypes[NodeTypes[selected_node.type].properties[prop].type].typeValues.length>1)
              $(propDiv).append(document.createElement("br"));
            if(selected_node.properties[prop] === undefined)
              selected_node.properties[prop] = [];
            for(var j in propertyTypes[NodeTypes[selected_node.type].properties[prop].type].typeValues) {
              if(selected_node.properties[prop][j]===undefined) {
                selected_node.properties[prop][j] = propertyTypes[NodeTypes[selected_node.type].properties[prop].type].typeValues[j].defaultValue;
                console.log("Undefined property..." + selected_node.properties[prop][j]);
              }
              $(propDiv).append(generateNodeTypePropertyValue(prop,j,
                                propertyTypes[NodeTypes[selected_node.type].properties[prop].type].typeValues[j],selected_node.properties[prop][j]));
            }
            $("#node_properties").append(propDiv);

          }
        } else {
          $("#properties_label").hide();
        }
        $("#inspector h3").html("Node Selected");
        var redacted_node = {id:selected_node.id,
                           reflexive:selected_node.reflexive,
                           type:selected_node.type
                          }

        $("#inspector pre").html(JSON.stringify(redacted_node,null,2));

        inspector_type="inspector";
        $(".inspector_div").hide();
        $("#inspector").show();
      } else {
        $("#inspector").hide();
      }
      
      selected_link = null;

      // reposition drag line
      drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);
      restart();
    })
    .on('mouseup', function(d) {
      if(!mousedown_node) return;

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if(mouseup_node === mousedown_node) { resetMouseVars(); return; }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans

      var source, target, direction;
      if(mousedown_node.id < mouseup_node.id) {
        source = mousedown_node;
        target = mouseup_node;
        direction = 'right';
      } else {
        source = mouseup_node;
        target = mousedown_node;
        direction = 'left';
      }
    
      var link;
      link = links.filter(function(l) {
        return (l.source === source && l.target === target);
      })[0];

      if(link) {
        // No links are bidirectional in SIGs)
        //link[direction] = true;
      } else {
        var left_valid = false, right_valid = false, homogeneous_valid = false;
        var node_type
        for(node_type in LinkTypes[currentLinkType].left_nodes) {
          if(direction==="left") {
            left_valid = left_valid || (source.type === LinkTypes[currentLinkType].right_nodes[node_type]);
          } else {
            left_valid = left_valid || (source.type === LinkTypes[currentLinkType].left_nodes[node_type]);
          }
        }
        for(node_type in LinkTypes[currentLinkType].right_nodes) {
          if(direction==="left") {
            right_valid = right_valid || (target.type === LinkTypes[currentLinkType].left_nodes[node_type]);
          } else {
            right_valid = right_valid || (target.type === LinkTypes[currentLinkType].right_nodes[node_type]);
          }
        }
        homogeneous_valid = !LinkTypes[currentLinkType].homogeneous || (source.type === target.type);
        if(left_valid && right_valid && homogeneous_valid) { 
          link = {id:lastLinkId++, source: source, target: target, left: false, right: false, type:currentLinkType};
          link[direction] = true;
          writeToLog("<p>Link created from <b>"+link.source.id+"</b> to <b>"+link.target.id+"</b> of type "+link.type+"</p>");
          links.push(link);
          outputSchemaGraph();
          window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
          window.localStorage.setItem("local_graphs",JSON.stringify(local_graphs));
        } else {
          return;
        }
        
      }
      // select new link
      selected_link = link;
      $("#inspector h3").html("Link Selected");
      var redacted_link = {id:selected_link.id,
                           type:selected_link.type,
                           left:selected_link.left,
                           right:selected_link.right,
                           source:{id:selected_link.source.id,
                                   type:selected_link.source.type
                                  },
                           target:{id:selected_link.target.id,
                                   type:selected_link.target.type}
                          };
      $("#inspector pre").html(JSON.stringify(redacted_link,null,2));
      $("#inspector textarea").html();
      selected_node = null;
      restart();
    });

  // show node IDs
  g.append('svg:text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('class', 'id')
  .text(function(d) { if(d.type==="S"){ return "S"+d.state_id; } else if (d.type==="T") { return d.label } else { return d.id; } });

  // remove old nodes
  circle['exit']().remove();

  // set the graph in motion
  force.start();
}

function mousedown() {
  // prevent I-bar on drag
  //d3.event.preventDefault();

  // because :active only works in WebKit?
  svg.classed('active', true);
  if(d3.event['ctrlKey'] || mousedown_node || mousedown_link) return;
  if(currentGraphId===-1) {
    return;
  }
  if(currentNodeType==="") {
    return;
  }
  var point,node;
  if (d3.event.type !== "touchstart") {
  // insert new node at point
    point = d3.mouse(this),
    node = {id: ++lastNodeId, reflexive: false, type: currentNodeType, type_id: NodeTypes[currentNodeType].id};
  } else {
    point = d3.touch(this,null),
    node = {id: ++lastNodeId, reflexive: false, type: currentNodeType, type_id: NodeTypes[currentNodeType].id};    
  }
  if(currentNodeType == "S") {
    node.state_id = curState;
    curState++;
  }
  node.x = point[0];
  node.y = point[1];
  nodes.push(node);
  outputSchemaGraph();
  window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
  window.localStorage.setItem("local_graphs",JSON.stringify(local_graphs));
  restart();
}

function mousemove() {
  if(!mousedown_node) return;
  // update drag line
if(d3.mouse(this)) {
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);
} else if (d3.touch(this,null)) {
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.touch(this,null)[0] + ',' + d3.touch(this,null)[1]);
}
  restart();
}

function mouseup() {
  if(mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function spliceLinksForNode(node) {
  var toSplice = links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
}

// only respond once per keydown
var lastKeyDown = -1;

function keydown() {
  if(textInput) {
    if(d3.event['keyCode'] === 13)
      commitText(d3.event);
    else
      return;
  }
  d3.event['preventDefault']();

  if(lastKeyDown !== -1) return;
  lastKeyDown = d3.event['keyCode'];

  // ctrl
  if(d3.event['keyCode'] === 17) {
    circle.call(force.drag);
    svg.classed('ctrl', true);
  }

  if(!selected_node && !selected_link) return;
  switch(d3.event['keyCode']) {
    case 8: // backspace
    case 46: // delete
      if(selected_node) {
        nodes.splice(nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      } else if(selected_link) {
        links.splice(links.indexOf(selected_link), 1);
      }
      selected_link = null;
      selected_node = null;
      $("#inspector h3").html("");
      $("#inspector pre").html("");
      $("#inspector textarea").html("");
    outputSchemaGraph();
    window.localStorage.setItem("current_graphs",JSON.stringify(current_graphs));
    window.localStorage.setItem("local_graphs",JSON.stringify(local_graphs));
      restart();
      break;
    case 66: // B
      if(selected_link) {
        // set link direction to both left and right
        selected_link.left = true;
        selected_link.right = true;
      }
      restart();
      break;
    case 76: // L
      if(selected_link) {
        // set link direction to left only
        selected_link.left = true;
        selected_link.right = false;
      }
      restart();
      break;
    case 82: // R
      if(selected_node) {
        // toggle node reflexivity
        selected_node.reflexive = !selected_node.reflexive;
      } else if(selected_link) {
        // set link direction to right only
        selected_link.left = false;
        selected_link.right = true;
      }
      restart();
      break;
  }
}

function keyup() {
  lastKeyDown = -1;

  // ctrl
  if(d3.event['keyCode'] === 17) {
    circle
      .on('mousedown.drag', null)
      .on('touchstart.drag', null);
    svg.classed('ctrl', false);
  }
}

function touchmove(e) {
}

function touchstart(e) {
}

function touchend(e) {
}

function saveJson(){
  copyToClipboard($("#json_output")[0])
}

// app starts here
svg.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('touchstart', touchstart)
  .on('touchmove', touchmove)
  .on('touchend', touchend)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
  restart();

// Populates the avilable node types for left and right hand sides of
// links
function updateValidNodes() {
  $("select.validNodes").html("");
  var select = $("select.validNodes").each(function(index, curElem){
                 for(var node in NodeTypes) {
                   var newOption = document.createElement("option");
                   newOption.value=node;
                   newOption.innerHTML=NodeTypes[node].name;
                   $(this).append(newOption);
                 }
                 $(curElem).attr("size",Object.keys(NodeTypes).length);
               });
  $("#validLeftNodes").change(leftNodesChanged);
  $("#validRightNodes").change(rightNodesChanged);
}

// Creates a node type property element based on a property object. 
function generateNodeTypeProperty(nodeProperty,booleanInput) {

  // Add a property line to the node configuration panel
  var property_line = document.createElement("div");
  property_line.id=nodeProperty.id;
  property_line.className = "node_type_property";
/*  var name = document.createElement("span");
  name.className = "node_type_property_name";
  name.innerHTML = nodeProperty.name;
  $(property_line).append(name);*/
  var select = document.createElement("select");
  select.name = 'node_type_property_type';
  select.className = 'node_type_property_type';
  for (var i in propertyTypes) {
      var option = document.createElement("option");
      option.setAttribute("value",i);
      if(i===nodeProperty.type)
        option.setAttribute("selected","");
    option.innerHTML = i;
    $(select).append(option);
  }
  $(property_line).append(select);
  if(propertyTypes[nodeProperty.type].typeValues.length>1)
    $(property_line).append(document.createElement("br"));
  for(var j in propertyTypes[nodeProperty.type].typeValues) {
    var propDiv = document.createElement("div");
    propDiv.className = "propertyTypeValue";
    var label = document.createElement("label");
    label.innerHTML = propertyTypes[nodeProperty.type].typeValues[j].label;
    $(propDiv).append(label);
    var value = document.createElement("input")
    value.className = "node_type_property_default";
    value.id = nodeProperty.id + "-" + j;
    value.type = "text";
    value.name = nodeProperty.id;
    value.value=propertyTypes[nodeProperty.type].typeValues[j].defaultValue;
    $(propDiv).append(value);
    $(property_line).append(generateNodeTypePropertyValue(nodeProperty.id,j,propertyTypes[nodeProperty.type].typeValues[j],undefined));
  }
  return property_line
}

function createNodeTypeProperty(e) {
  if(!NodeTypes[currentNodeType].hasOwnProperty("properties")){
    NodeTypes[currentNodeType].properties=[];
  }
  var newProperty = {id:"prop-"+NodeTypes[currentNodeType].properties.length,name:"Property",type:"Number",defaultValue:0};
  NodeTypes[currentNodeType].properties.push(newProperty);
  var property_line = generateNodeTypeProperty(newProperty,false);
  $("#node_type_properties").append(property_line);
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
}

$("#createNodeType").click(function() {
  if(currentSchemaId===-1) {
    return;
  }
  var newNodeSymbol = "n"+nodeId++;
  var newNode = {};
  newNode['id'] = nodeId-1;
  newNode['name']="New Node Type "+(nodeId-1);
  currentNodeType = newNodeSymbol;
  newNode['description']="Click To Edit Description";
  NodeTypes[newNodeSymbol]=newNode;
  updateValidNodes();
  var i = 0;
  // Just reset the element for now.
  var newgroup = $("#nodes");
  $("#nodes label").remove()
  for(var key in NodeTypes){
    var label = document.createElement("label");
    label.className = "toggle-btn symbol " + (key === newNodeSymbol ? "success" : "");
      var circleSvg = document.createElement("svg");
      $(circleSvg).attr("width",30);
      $(circleSvg).attr("height",30);
      $(circleSvg).addClass("labelNode");
      $(circleSvg).addClass("node");
      var circleNode = document.createElement("circle");
      $(circleNode).attr("r",15);
      $(circleNode).attr("cx",15);
      $(circleNode).attr("cy",15);
      $(circleNode).attr("fill",d3.rgb(colors(NodeTypes[key].id)).toString());
      circleSvg.appendChild(circleNode);
//    $(label).css("background-color",d3.rgb(colors(NodeTypes[key].id)).toString());
    var input = document.createElement("input");
    input.value=key;
    input.name="elements";
    input.type="radio";
    $(input).addClass("visuallyhidden");
    $(newgroup).append(label)
    $(label).append(input);
    var nameAbbrev = NodeTypes[key].name;
    for (var name in abbreviations) {
      nameAbbrev = nameAbbrev.replace(name,abbreviations[name]);
    }
    var span = document.createElement("span");
    span.id="label"+key;
    span.innerHTML = nameAbbrev;
    $(label).append($(span));
    label.appendChild(circleSvg);
    label.innerHTML+="";
    i++;
    }
  newgroup.append(node_configuration);
  //$(explanation).click(editNodeDescription);
  $(node_explanation).show();
  $(".node_type_property").remove();
  $(node_configuration).show();
  $(link_configuration).hide();
  $("#links > label").removeClass("success");
  currentLinkType = "";
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
  outputSchemaGraph();
});

$("#createLinkType").click(function() {
  var newLinkSymbol = "l"+linkTypeId++;
  var newLink = {};
  var newgroup;
  newLink['name']="New Link Type " +(linkTypeId-1);
  newLink['id']=linkTypeId-1;
  currentLinkType = newLinkSymbol;
  newLink['description']="Click to Edit Description";
  LinkTypes[newLinkSymbol]=newLink;
  var i = 0;
  // Just reset the element for now.
  $("#links label").not("#link_configuration label").remove();
  newgroup = $("#links");
  for(var key in LinkTypes){
    var label = document.createElement("label");
    label.className = "toggle-btn symbol " + (key === newLinkSymbol ? "success" : "");
    //$(label).css("background-color",d3.rgb(colors(LinkTypes[key].id)).toString());
    var input = document.createElement("input");
    input.value=key;
    input.name="elements";
    input.type="radio";
    $(input).addClass("visuallyhidden");
      $(newgroup).append(label)
      $(label).append(input);
      var nameAbbrev = LinkTypes[key].name;
      for (var name in abbreviations) {
        nameAbbrev = nameAbbrev.replace(name,abbreviations[name]);
      }
      label.innerHTML+="<span id='label"+key+"'>"+nameAbbrev+"</span>";
      label.onclick = null;
      i++;
    }
  newgroup.append(link_configuration);
  $("#nodes > label").removeClass("success");
  currentNodeType = "";
  $(node_configuration).hide();
  $(link_configuration).show();
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
  outputSchemaGraph();
});

function outputSchemaGraph() {
  if(out_schema) {
    $("#json_output").html(prettyPrintSchema());
  } else {
    $("#json_output").html(prettyPrintGraph());
  }
}

function prettyPrintGraph() {
  var graph = {name:graph_name,
               graphId:currentGraphId,
               file:current_graph_location,
               type:"semantic_graph",
               schema:current_schema_location,
               schemaVersion:schema_version,
               version:graph_version,
               nodes:nodes,
               links:links};
  return JSON.stringify(graph,null,2);
  
}

function prettyPrintSchema() {
  var schema = {name:schema_name,type:"schema",version:schema_version,nodeTypes:NodeTypes,linkTypes:LinkTypes};
  return JSON.stringify(schema,null,2);
}

function copyToClipboard(elem) {
    var currentFocus: Element = document.activeElement;
    elem.focus();
    elem.setSelectionRange(0, elem.value.length);
  // copy the selection
    var succeed;
    try {
    	  succeed = document.execCommand("copy");
    } catch(e) {
        succeed = false;
    }
// restore original focus

    if (currentFocus && typeof currentFocus['focus'] === "function") {
        currentFocus['focus']();
    }
}

function saveToFile(data,filename) {
          if(!data) {
            return;
        }

        if(!filename) filename = schema_name+'.json'

        if(typeof data === "object"){
            data = JSON.stringify(data, undefined, 4)
        }

        var blob = new Blob([data], {type: 'text/json'}),
            e = document.createEvent('MouseEvents'),
            a: HTMLAnchorElement = document.createElement('a')

        a['download'] = filename
        a.href = window.URL.createObjectURL(blob)
        a.dataset['downloadurl'] =  ['text/json', a['download'], a.href].join(':')
        e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
        a.dispatchEvent(e)
}

function loadCurrentContent() {
    var jquery_element: HTMLElement = $("#json_input")[0];
    if (!in_schema) {
        import_graph_content(jquery_element.innerText);
    } else {
        import_schema_content(jquery_element.innerText, undefined);
  }
}

function writeToLog(logContent) {
  
}

function isDragSourceExternalFile(dataTransfer){
    // Source detection for Safari v5.1.7 on Windows.
    if (typeof Clipboard != 'undefined') {
        if (dataTransfer.constructor == Clipboard) {
            if (dataTransfer.files.length > 0)
                return true;
            else
                return false;
        }
    }

    // Source detection for Firefox on Windows.
    if (typeof DOMStringList != 'undefined'){
        var DragDataType = dataTransfer.types;
        if (DragDataType.constructor == DOMStringList){
            if (DragDataType.contains('Files'))
                return true;
            else
                return false;
        }
    }

    // Source detection for Chrome on Windows.
    if (typeof Array != 'undefined'){
        var DragDataType = dataTransfer.types;
        if (DragDataType.constructor == Array){
            if (DragDataType.indexOf('Files') != -1)
                return true;
            else
                return false;
        }
    }
}

// Handles loading graphs and schemas from a local file dragged over.
$(document).on('dragenter', function(e){
    e.preventDefault();
    e.stopPropagation();
});
$(document).on('dragover', function(e){
    var dropEvent = <DragEvent>e.originalEvent;
    e.preventDefault();
    e.stopPropagation();
    var IsFile = isDragSourceExternalFile(dropEvent.dataTransfer);
});
$(document).on('drop', function (e) {
    var dropEvent = <DragEvent>e.originalEvent;
        if(dropEvent.dataTransfer){
            if(dropEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                /*UPLOAD FILES HERE*/
                //upload(e.originalEvent.dataTransfer.files);
                var file = dropEvent.dataTransfer.files[0];           
                var reader = new FileReader();
                reader.onload = function() {
                  var response = jQuery.parseJSON(this.result);
                  if(typeof response==="object")
                  {
                    if(response.type==="schema") {
                      import_schema_content(response,undefined);
                    } else if (response.type==="semantic_graph") {
                      if(response.schema){
                        import_schema(response.schema,undefined);
                      }
                      import_graph_content(response);
                    }
                  }
                }
                reader.readAsText(file);
            }
        }
    });

// LinkType Configuration 
$("#link_directed").change(function (e) {
    var checkBox = <HTMLInputElement>e.target;
    LinkTypes[currentLinkType].directed = checkBox.checked;
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
});
$("#link_homogeneous").change(function (e) {
    var checkBox = <HTMLInputElement>e.target;
  LinkTypes[currentLinkType].homogeneous=checkBox.checked;
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
});
$("#validLeftNodes").change(leftNodesChanged);
function leftNodesChanged (e){
    LinkTypes[currentLinkType].left_nodes=[];
  for(var i = 0 ; i < e.target.length; i++) {
    if(e.target[i].selected)
      LinkTypes[currentLinkType].left_nodes.push($(e.target[i]).prop("value"));
  }
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
}

$("#validRightNodes").change(rightNodesChanged);
function rightNodesChanged(e){
    LinkTypes[currentLinkType].right_nodes=[];  
  for(var i = 0 ; i < e.target.length; i++) {
    if(e.target[i].selected)
      LinkTypes[currentLinkType].right_nodes.push($(e.target[i]).prop("value"));
  }
  window.localStorage.setItem("current_schemas",JSON.stringify(current_schemas));
};

// Load local storage.
function loadLocalStorage() {
  if(typeof(Storage) !== "undefined") {
    // Code for localStorage/sessionStorage.

    if(window.localStorage.getItem("lastGraphId")!=undefined)
      lastGraphId=window.localStorage.getItem("lastGraphId");
    else
      lastGraphId=0;
    var localLastSchemaId = window.localStorage.getItem("lastSchemaId");
    if(localLastSchemaId!=undefined)
      lastSchemaId=localLastSchemaId;
    else
      lastSchemaId=-1;
    var localSchemas = jQuery.parseJSON(window.localStorage.getItem("local_schemas"));
    if(localSchemas) {
      local_schemas = 
        localSchemas;
      for (var i in local_schemas) {
          var input = document.createElement("input");
          input.id = "schemaLabel-" + (local_schemas[i].schemaId);
          input.value = local_schemas[i].file;
          input.style.display = "none";
        var element = document.createElement("label");
        element.htmlFor="schemaLabel-"+(local_schemas[i].schemaId);
        element.className="schemaLabel local";
        element.innerHTML = "Schema " + local_schemas[i].schemaId;
        element.appendChild(input);
        $(element).insertBefore("#available_schemas .buttons");
        if (lastSchemaId < local_schemas[i].schemaId) {
            lastSchemaId = local_schemas[i].schemaId;
            window.localStorage.setItem("lastSchemaId", lastSchemaId.toString());
        }
        schemas.push(local_schemas[i]);
      }
    } else {
      local_schemas = [];
    }
    if(jQuery.parseJSON(window.localStorage.getItem("local_graphs"))) {
      local_graphs = 
        jQuery.parseJSON(window.localStorage.getItem("local_graphs"));
      for (var i in local_graphs) {
          var input = document.createElement("input");
          input.id = "graphLabel-" + (local_graphs[i].graphId);
          input.value = local_graphs[i].file;
          input.style.display = "none";
          var element = document.createElement("label");
          element.htmlFor = "graphLabel-" + (local_graphs[i].graphId);
          element.className = "graphLabel local";
          element.innerHTML = "Graph " + local_graphs[i].graphId;
          element.appendChild(input);
          $(element).insertBefore("#available_graphs .buttons");
          if (lastGraphId < local_graphs[i].graphId) {
              lastGraphId = local_graphs[i].graphId;
              window.localStorage.setItem("lastGraphId", lastGraphId.toString());
          }
          graphs.push(local_graphs[i]);
      }
    } else {
      local_graphs = [];
    }
    var currentSchemas = 
      jQuery.parseJSON(window.localStorage.getItem("current_schemas"));
    if(typeof currentSchemas === "object"){
      for(var j in currentSchemas) {
        import_schema_content(currentSchemas[j],undefined);
      }
    }
    var curGraphs = jQuery.parseJSON(window.localStorage.getItem("current_graphs"))
    if(typeof curGraphs === "object" && curGraphs != null && curGraphs.length != 0){
      var data = curGraphs[0];
      var schema_location = "";
      if(data.schema){
        import_schema(data.schema,function() {import_graph_content(data)});
      }
    }
    

  } else {
    // Sorry! No Web Storage support..
  }
}
loadLocalStorage();

function myFunction() {
  var i = 0;
  curTime = video.currentTime;
  if (duration === null) {
    duration = video.duration;
  }
  showTime(ctx, can, cursorTime, curTime, duration);
}

function mouseDown(e) {
  var i = 0;
  mouseIsDown = 1;
  curTime = cursorTime;
  video.currentTime = curTime;
  mouseXY(e);
}

function mouseXY(e) {
  if (e==undefined) {
    e = event;
  }
  if(e.type==="touchstart" || e.type==="touchmove") 
  {
    return;
  }
  if (e.target === can) {
    canX = e.pageX - can.offsetLeft-180;
    canY = e.pageY - can.offsetTop;
    cursorTime = duration * (canX / can.width);
    //curTime = cursorTime;
    showTime(ctx, can, cursorTime, curTime, duration);
  }
}
