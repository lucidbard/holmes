/*global VTTCue*/
var module = (function () {
    "use strict";
    var currentTime_node;
    var thumb_ctx;
    var thumb_can;
    var playButton, stopButton, editPlayButton, editStopButton;
    var targetTime;
    var textTracks;
    // one for each track element
    var curSegmentBegin = 0;
    var curTime = 0;
    var e_curTime = 0;
    var cursorTime = 0;
    var e_cursorTime = 0;
    var duration = 0;
    var e_duration = 0;
    var curSegment = 0;
    var timeoutVariable;
    var video_thumb;
    var thumbnail_shot = 0;
    var can, ctx, canX, canY, mouseIsDown = 0;
    var e_can, e_ctx, e_canX, e_canY, e_mouseIsDown = 0;
    var e_nextSegmentTrigger;
    var e_nextSegment = 0;
    var cur_segment = -1;
    var e_cur_segment = -1;
    var cursorLine = 0;
    var decision_list = [];
    var beat_list = [];
    var choice_list = [];
    var segment_list = [];
    var e_segment_list = null;
    var shot_list = [];
    var in_edit_segment = false;
    var previousEditDurations = null;
    var edit_list = [0, 0, 0, 0];
    var line_list = [];
    var render_shot = 0;
    var thumbTimeout;
    var thumbnail_cursor;
    var outer_div;
    var PLAY_EDITED = true;
    var video, $output;
    var scale = 0.25;
    var loaded_choices = false;
    var on_loaded_choices;
    var loaded_dialogue = false;
    var on_loaded_dialogue;
    var dialogue_data = null;
    var loaded_segments = false;
    var on_loaded_segments;
    var nextFrameImage = function () {
        var currentTime = Math.floor((curTime - Math.floor(curTime)) * 30.0);
        curTime = Math.floor(curTime) + ((currentTime + 1.01) / 30.0);
        video.currentTime = curTime;
        video_thumb.currentTime = curTime;
        currentTime = Math.floor((curTime - Math.floor(curTime)) * 30.0);
        //curTime = Math.floor(curTime)+((currentTime-1.0)/30.0);
        //video.currentTime = curTime; 
    };
    var captureImage = function () {
        var canvas = document.createElement("canvas");
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        canvas.getContext('2d')
            .drawImage(video, 0, 0, canvas.width, canvas.height);
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        $(outer_div).prepend(img);
    };
    function extractTimeVTT(timeString) {
        var components = timeString.split(":");
        return 60 * 60 * parseInt(components[0], 10) + 60 * parseFloat(components[1], 10) + parseInt(components[2], 10);
    }
    function extractTime(timeString) {
        var components = timeString.split(":");
        return 60 * parseInt(components[0], 10) + parseInt(components[1], 10) + parseInt(components[2], 10) / 30;
    }
    function padNumber(timeIn) {
        if (timeIn < 10) {
            return "0" + timeIn;
        }
        else {
            return timeIn;
        }
    }
    /**
     * @function padTime
     * Creates a string of the format 00:00:00 where the format is MM:SS:FF
     * Minutes:Seconds:Frames
     * @param {Number}
    */
    function padTime(timeNum) {
        return padNumber((Math.floor(timeNum / 60))) + ":" + padNumber(Math.floor(timeNum) % 60) + ":" + padNumber((Math.floor((timeNum - Math.floor(timeNum)) * 30.0)));
    }
    function showCursor(start, total_length, color, can, ctx) {
        ctx.beginPath();
        ctx.rect((start / total_length) * can.width - 1, 0, 2, 100);
        ctx.fillStyle = color;
        ctx.fill();
    }
    function showTimestamp(ctx, can, time, color, ht, offset) {
        ctx.font = "12pt Helvetica";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        // draw text at center, max length to fit on canvas
        ctx.fillText(padTime(time), can.width / 2, ht * can.height + offset, can.width - 10);
    }
    function getLinesByTime(time) {
        var returnSet = [], line;
        for (line in line_list) {
            if (line_list.hasOwnProperty(line)) {
                if ((extractTime(line_list[line].begin) < time && extractTime(line_list[line].end)) > time) {
                    returnSet.push(line_list[line]);
                }
            }
        }
        return returnSet;
    }
    function drawSegment(begin, length, canvas, context, selected, total_length) {
        context.beginPath();
        if (selected) {
            // Detect current shot
            context.fillStyle = "red";
        }
        else {
            context.fillStyle = "white";
        }
        context.fillRect((begin / total_length) * canvas.width - 1, 0, (((length) / total_length) * canvas.width) - 2, 10);
        context.fill();
    }
    function drawLine(start, length, selected, line, total_length, context, canvas) {
        context.beginPath();
        if (selected) {
            context.fillStyle = "yellow";
            if (curTime >= start && curTime <= start + length) {
                $(".line").removeClass("playing");
                $.each(getLinesByTime(curTime), function (key, line) {
                    $("#line_" + line.lineid).addClass("playing");
                });
            }
        }
        else if (cursorLine !== -1 && line.lineid === cursorLine) {
            context.fillStyle = "gold";
        }
        else {
            // based on speaker
            if (line.speaker === "bigby") {
                context.fillStyle = "red";
            }
            else if (line.speaker === "toad") {
                context.fillStyle = "green";
            }
            else {
                context.fillStyle = "white";
            }
        }
        context.fillRect((start / total_length) * canvas.width - 1, 15, (((length) / total_length) * canvas.width) - 2, 10);
        context.fill();
    }
    function showTime(ctx, can, cursorTime, curTime, duration, segment_list) {
        var x = 0, y = null, begin, end, selected;
        if (segment_list === null) {
            return;
        }
        ctx.clearRect(0, 0, can.width, can.height);
        showTimestamp(ctx, can, cursorTime, "rgb(255,64,64)", 0.25, 10);
        showTimestamp(ctx, can, curTime, "rgb(64,255,64)", 0.75, 0);
        ctx.textAlign = "left";
        var accumulatedTime = 0;
        for (x = 0; x < segment_list.length; x += 1) {
            begin = extractTime(segment_list[x].begin);
            end = extractTime(segment_list[x].end);
            selected = (cursorTime >= begin && cursorTime <= end);
            if (selected) {
                ctx.fillText(x.toString(), 0, can.height / 4, can.width - 10);
            }
            drawSegment(accumulatedTime, end - begin, can, ctx, selected, duration);
            accumulatedTime += end - begin;
        }
        for (y in line_list) {
            if (line_list.hasOwnProperty(y)) {
                begin = extractTime(line_list[y].begin);
                end = extractTime(line_list[y].end);
                selected = ((cursorTime >= begin && cursorTime <= end) || (curTime >= begin && curTime <= end));
                drawLine(begin, end - begin, selected, line_list[y], duration, ctx, can);
            }
        }
        ctx.textAlign = "left";
        ctx.fillText(cur_segment, 0, 3 * can.height / 4, can.width - 10);
        showCursor(cursorTime, duration, "green", can, ctx);
        showCursor(curTime, duration, "red", can, ctx);
    }
    function setTime(time) {
        curTime = time;
        video.currentTime = curTime;
        showTime(ctx, can, cursorTime, curTime, duration, segment_list);
    }
    function getSegmentIndex(curTime) {
        var i = 0;
        for (i = 0; i < segment_list.length; i += 1) {
            if (Math.floor(extractTime(segment_list[i].begin) * 30) <= Math.floor(curTime * 30) && (Math.floor(extractTime(segment_list[i].end) * 30)) >= Math.floor(curTime) * 30) {
                return i;
            }
        }
    }
    function nextSegment() {
        //console.log("Next scene");
        var begin = extractTime(e_segment_list[e_nextSegment].begin);
        var timerFor = 1000 * (extractTime(e_segment_list[e_nextSegment].end) - begin);
        //console.log(curTime);
        //console.log(" Timer for " + timerFor);
        //console.log(e_segment_list[e_nextSegment].begin);
        video.currentTime = begin;
        curTime = begin;
        e_nextSegment++;
        window.clearTimeout(e_nextSegmentTrigger);
        e_nextSegmentTrigger = window.setTimeout(nextSegment, timerFor);
    }
    function selectShot(shot_number) {
        cursorTime = extractTime(segment_list[shot_number].begin);
        cur_segment = shot_number;
        showTime(ctx, can, cursorTime, curTime, duration, segment_list);
    }
    function myPlayToggle(playTrue) {
        if (video.paused) {
            //console.log("MyPlayToggle");
            video.play();
        }
        else if (!playTrue) {
            video.pause();
            window.clearTimeout(e_nextSegmentTrigger);
        }
    }
    var inputChangeTrigger = function () {
        var curChoice = 0, i = 0, totalDuration = 0, editIndex = 0;
        //console.log("CHANGE!");
        if ($(this).attr("name")) {
            $("div[id='choice_" + $(this).attr("name") + "']").html($(this).attr("name") + ":" + $(this).attr("value"));
            edit_list[$(this).attr("name")] = parseInt($(this).attr("value"), 10);
            console.log("EDIT LIST");
            console.log(edit_list);
            buildEditList(true);
        }
    };
    var continue_func = function () {
        var begin = extractTime(segment_list[render_shot].begin);
        video_thumb.currentTime = begin;
        video_thumb.play();
    };
    var curSegment = 0;
    var curChoice = -1;
    function thumbPlaying(e) {
        console.log("Thumb playing...");
        video_thumb.pause();
        thumb_ctx.drawImage(video_thumb, 0, 0, thumb_can.width, thumb_can.height);
        /*        thumb_ctx.font = "32pt Helvetica";
                thumb_ctx.textAlign = "center";
                thumb_ctx.textBaseline = "middle";
                switch (segment_list[render_shot].type) {
                case "cutscene":
                    thumb_ctx.fillStyle = "rgb(255,64,64)";
                    break;
                case "result":
                    thumb_ctx.fillStyle = "rgb(64,255,64)";
                    break;
                case "choice":
                    thumb_ctx.fillStyle = "rgb(64,64,255)";
                    break;
                }
                thumb_ctx.fillText(segment_list[render_shot].segment_id.toString(), thumb_can.width/2, thumb_can.height/2, thumb_can.width/2);*/
        var img = document.createElement("img");
        img.setAttribute("id", render_shot.toString());
        img.setAttribute("class", "shot_thumb");
        img.src = thumb_can.toDataURL();
        segment_list[render_shot].thumb = img.src;
        // if the current segment is not the currently selected choice, hide it.
        if (segment_list[render_shot].type === "result") {
            if (segment_list[render_shot].alt != edit_list[curChoice]) {
                $(img).hide();
            }
        }
        else if (segment_list[render_shot].type === "choice") {
            $(img).hide();
            curChoice++;
        }
        else if (segment_list[render_shot].type === "cutscene") {
            $(img).hide();
        }
        if (segment_list[render_shot].segment_id !== curSegment) {
            curSegment = segment_list[render_shot].segment_id;
            if (outer_div !== null) {
                $(outer_div).addClass("outer_div");
                $output.append(outer_div);
            }
            outer_div = document.createElement("div");
        }
        $(outer_div).append(img);
        $(img).mouseover(function (e) {
            var curTarget = e.currentTarget;
            function thumbShotTrigger() {
                video_thumb.currentTime = thumbnail_cursor;
            }
            // Records a single frame of the video_thumb
            function thumbNowPlaying() {
                var offset = $(curTarget).offset();
                if (thumbTimeout) {
                    clearInterval(thumbTimeout);
                }
                $(video_thumb).css(offset);
                //console.log("Moving video to " + offset);
                $(video_thumb).show();
                thumbTimeout = setInterval(thumbShotTrigger, (extractTime(segment_list[cur_segment].end) - extractTime(segment_list[cur_segment].begin)) * 1000);
                video_thumb.removeEventListener("playing", thumbNowPlaying);
            }
            selectShot(curTarget.id);
            if (thumbnail_shot !== parseInt(curTarget.id)) {
                thumbnail_shot = parseInt(curTarget.id);
                video_thumb.addEventListener("playing", thumbNowPlaying);
                video_thumb.currentTime = cursorTime;
                $(".active").removeClass("active");
                $(e.currentTarget).addClass("active");
                thumbnail_cursor = cursorTime;
                video_thumb.play();
            }
        });
        $(img).click(function (e) {
            var i;
            var curTarget = e.currentTarget;
            setTime(extractTime(segment_list[curTarget.id].begin));
            //console.log("Set time to " + segment_list[e.currentTarget.id].begin);
            var beginTime = extractTime(segment_list[curTarget.id].begin);
            var segIndex = getSegmentIndex(curTime);
            //console.log(segIndex);
            //console.log("From beginning..." + segment_list[segIndex].begin + " + " + padTime(curTime));
            buildEditList(false);
            window.clearTimeout(e_nextSegmentTrigger);
            e_nextSegmentTrigger = window.setTimeout(nextSegment, 1000 * (extractTime(segment_list[segIndex].end) - beginTime));
            myPlayToggle(true);
        });
        var selected_choice = 0;
        if (segment_list[render_shot].type === "choice") {
            var div = document.createElement("div"), x = 0;
            $(div).addClass("toggle-btn-grp");
            for (x = 0; x < choice_list[segment_list[render_shot].choices_id].choices.length; x++) {
                var label = document.createElement("label");
                if (x === 0) {
                    $(label).addClass("success");
                }
                $(label).addClass("toggle-btn");
                $(label).html(choice_list[segment_list[render_shot].choices_id].choices[x].choice_text);
                var input = document.createElement("input");
                input.type = "radio";
                input.setAttribute("name", segment_list[render_shot].choices_id);
                input.setAttribute("value", x.toString());
                $(input).change(inputChangeTrigger);
                $(label).append(input);
                $(div).append(label);
            }
            //var selection = document.createElement('div');
            //$(selection).html(segment_list[render_shot].choices_id + ":" + edit_list[segment_list[render_shot].choices_id]);
            //selection.setAttribute("id", "choice_" + segment_list[render_shot].choices_id);
            //$(selection).addClass("selection_label");
            //$(outer_div).append(selection);
            $(outer_div).append(div);
        }
        if (render_shot++ < segment_list.length - 1) {
            continue_func();
        }
        else {
            $(".toggle-btn:not('.noscript') input[type=radio]").addClass("visuallyhidden");
            $(".toggle-btn:not('.noscript') input[type=radio]").change(function () {
                if ($(this).attr("name")) {
                    $(this).parent().addClass("success").siblings().removeClass("success");
                }
                else {
                    $(this).parent().toggleClass("success");
                }
            });
            render_shot = 0;
            video_thumb.removeEventListener("playing", thumbPlaying);
            buildEditList(false);
        }
    }
    function renderShots() {
        console.log("Rendering Shots");
        thumb_can = document.createElement("canvas");
        thumb_ctx = thumb_can.getContext('2d');
        $output = $("#shot_sequence");
        thumb_can.width = video_thumb.videoWidth / 4;
        //console.log("Width:" + thumb_can.width);
        thumb_can.height = video_thumb.videoHeight / 4;
        outer_div = document.createElement('div');
        console.log(video_thumb);
        video_thumb.addEventListener("playing", thumbPlaying);
        // Play the thumbnail for just an instant and pause to extract the thumbnail.
        curSegment = 0;
        continue_func();
    }
    function showEditTime(ctx, can) {
    }
    function prevFrame() {
        var lastTime = Math.trunc((curTime - Math.floor(curTime)) * 30.0);
        setTime(Math.floor(curTime) + ((lastTime - 0.9) / 30.0));
    }
    function nextFrame() {
        var lastTime = Math.trunc((curTime - Math.floor(curTime)) * 30.0);
        setTime(Math.floor(curTime) + ((lastTime + 1.1) / 30.0));
    }
    function prevShot() {
        if (cur_segment > 0) {
            cur_segment--;
            setTime(extractTime(segment_list[cur_segment].begin));
        }
        showTime(ctx, can, cursorTime, curTime, duration, segment_list);
    }
    function nextShot() {
        if (cur_segment < segment_list.length - 1) {
            cur_segment++;
            setTime(extractTime(segment_list[cur_segment].begin));
        }
        showTime(ctx, can, cursorTime, curTime, duration, segment_list);
    }
    function checkKey(e) {
        e = e || window.event;
        if (e.keyCode === 32) {
            myPlayToggle(false);
            if (e.target == document.body) {
                e.preventDefault();
                return false;
            }
        }
        if (e.keyCode === 38) {
            // up arrow
            e.preventDefault();
            prevShot();
        }
        else if (e.keyCode === 40) {
            e.preventDefault();
            // down arrow
            nextShot();
        }
        else if (e.keyCode === 37) {
            e.preventDefault();
            prevFrame();
        }
        else if (e.keyCode === 39) {
            e.preventDefault();
            nextFrame();
        }
    }
    function mouseXY(e) {
        if (!e) {
            e = event;
        }
        if (e.type === "touchstart" || e.type === "touchmove") {
            return;
        }
        if (e.target === can) {
            canX = e.pageX - can.offsetLeft;
            canY = e.pageY - can.offsetTop;
            cursorTime = duration * (canX / can.width);
            curTime = cursorTime;
            showTime(ctx, can, cursorTime, curTime, duration, segment_list);
        }
        else if (e.target === e_can) {
            e_canX = e.pageX - e_can.offsetLeft;
            e_canY = e.pageY - e_can.offsetTop;
            e_cursorTime = e_duration * (e_canX / e_can.width);
            showTime(e_ctx, e_can, e_cursorTime, e_curTime, e_duration, e_segment_list);
        }
    }
    function mouseUp() {
        mouseIsDown = 0;
        mouseXY(null);
    }
    function touchUp() {
        mouseIsDown = 0;
    }
    function mouseDown(e) {
        var i = 0;
        //if (e.currentTarget == can)
        //   return;
        mouseIsDown = 1;
        curTime = cursorTime;
        video.currentTime = curTime;
        video_thumb.currentTime = curTime;
        var segIndex = getSegmentIndex(curTime);
        //console.log(segIndex);
        //console.log("From beginning..." + segment_list[segIndex].begin + " + " + padTime(curTime));
        buildEditList(false);
        mouseXY(null);
    }
    function showPos(evt) {
    }
    function touchXY(e) {
        if (!e) {
            e = event;
        }
        e.preventDefault();
        if (e.target === can) {
            canX = e.targetTouches[0].pageX - can.offsetLeft;
            canY = e.targetTouches[0].pageY - can.offsetTop;
            console.log(can.width);
            cursorTime = duration * (canX / can.width);
            curTime = duration * (canX / can.width);
            showTime(ctx, can, cursorTime, curTime, duration, segment_list);
        }
        else if (e.target === e_can) {
            canX = e.targetTouches[0].pageX - can.offsetLeft;
            canY = e.targetTouches[0].pageY - can.offsetTop;
            e_cursorTime = e_duration * (e_canX / e_can.width);
        }
        mouseDown(e);
        //        showPos(e);
    }
    function touchDown() {
        mouseIsDown = 1;
        touchXY(null);
        //console.log("TOCUHING!");
    }
    document.onkeydown = checkKey;
    function getPreviousEditDuration(segment_id) {
        var i;
        if (previousEditDurations === null || previousEditDurations[segment_id] === null) {
            //console.log("Calculating edit duration for " + segment_id);
            var durationTotal = 0;
            for (i = 0; i < e_segment_list.length; i++) {
                if (e_segment_list[i].segment_id === segment_id && e_segment_list[i].alt === segment_list[segment_id].alt) {
                    if (previousEditDurations === null) {
                        previousEditDurations = [];
                    }
                    previousEditDurations[segment_id] = durationTotal;
                    return durationTotal;
                }
                else {
                    durationTotal += extractTime(e_segment_list[i].end) - extractTime(e_segment_list[i].end);
                }
            }
            if (previousEditDurations === null) {
                previousEditDurations = [];
            }
            previousEditDurations[segment_id] = durationTotal;
            return durationTotal;
        }
        else {
            return previousEditDurations[segment_id];
        }
    }
    function myFunction() {
        var i = 0;
        curTime = video.currentTime;
        if (duration === null) {
            duration = video.duration;
        }
        // Calculate edit duration
        if (e_segment_list === null) {
            //console.log("calculating list...");
            e_segment_list = [];
            var curChoice = 0;
            var totalDuration = 0;
            var editIndex = 0;
            for (i = 0; i < segment_list.length; i++) {
                if ((curTime >= extractTime(segment_list[i].begin)) && (curTime <= extractTime(segment_list[i].end))) {
                    in_edit_segment = true;
                    e_cur_segment = editIndex;
                    e_nextSegment = editIndex + 1;
                }
                if (segment_list[i].type === "cutscene") {
                    e_segment_list.push(segment_list[i]);
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
                else if (segment_list[i].type === "choice") {
                    e_segment_list.push(segment_list[i]);
                    curChoice = segment_list[i].choices_id;
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
                else if (segment_list[i].type === "result" && segment_list[i].alt === edit_list[curChoice]) {
                    e_segment_list.push(segment_list[i]);
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
            }
            e_duration = totalDuration;
        }
        if (in_edit_segment)
            e_curTime = getPreviousEditDuration(e_cur_segment) + curTime - extractTime(segment_list[e_cur_segment].begin);
        else
            e_curTime = 0;
        showTime(ctx, can, cursorTime, curTime, duration, segment_list);
        showTime(e_ctx, e_can, e_cursorTime, e_curTime, e_duration, e_segment_list);
    }
    function buildEditList(forceRebuild) {
        var i = 0;
        if (e_segment_list !== null) {
            for (i = 0; i < e_segment_list.length; i++) {
                if (curTime >= extractTime(e_segment_list[i].begin) && curTime <= extractTime(e_segment_list[i].end)) {
                    //console.log("Next edit segment will be " + i);
                    e_nextSegment = i + 1;
                }
            }
        }
        if (e_segment_list == null || forceRebuild) {
            if (forceRebuild)
                $("#editSegmentList").html("");
            console.log("EDIT LIST NULL\nCalculating list...");
            e_segment_list = [];
            var curChoice = 0;
            var totalDuration = 0;
            var editIndex = 0;
            for (i = 0; i < segment_list.length; i++) {
                segment_list[i].original_id = i;
                if (curTime >= extractTime(segment_list[i].begin) && curTime <= extractTime(segment_list[i].end)) {
                    in_edit_segment = true;
                    e_cur_segment = editIndex;
                    e_nextSegment = editIndex + 1;
                }
                if (segment_list[i].type === "cutscene") {
                    e_segment_list.push(segment_list[i]);
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
                else if (segment_list[i].type === "choice") {
                    e_segment_list.push(segment_list[i]);
                    curChoice = segment_list[i].choices_id;
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
                else if (segment_list[i].type === "result" && segment_list[i].alt === edit_list[curChoice]) {
                    e_segment_list.push(segment_list[i]);
                    totalDuration += extractTime(segment_list[i].end) - extractTime(segment_list[i].begin);
                    editIndex++;
                }
            }
            e_duration = totalDuration;
            console.log(e_segment_list);
            console.log("Rendering list...");
            $.each(e_segment_list, function (index, segment) {
                var newSegment = document.createElement("div");
                $(newSegment).addClass("editSegment");
                var alt = "";
                if (segment.type === "result") {
                    alt = ":" + segment.alt;
                }
                var img = document.createElement("img");
                img.src = segment.thumb;
                img.setAttribute("id", segment.original_id);
                $(img).click(function (e) {
                    var i;
                    var curTarget = e.currentTarget;
                    setTime(extractTime(segment_list[curTarget.id].begin));
                    //console.log("Set time to " + segment_list[e.currentTarget.id].begin);
                    var beginTime = extractTime(segment_list[curTarget.id].begin);
                    var segIndex = getSegmentIndex(curTime);
                    //console.log(segIndex);
                    //console.log("From beginning..." + segment_list[segIndex].begin + " + " + padTime(curTime));
                    buildEditList(false);
                    window.clearTimeout(e_nextSegmentTrigger);
                    e_nextSegmentTrigger = window.setTimeout(nextSegment, 1000 * (extractTime(segment_list[segIndex].end) - beginTime));
                    myPlayToggle(true);
                });
                var html = segment.type + ": " + segment.segment_id + alt + "<br/>";
                $(newSegment).html(html);
                $(newSegment).append(img);
                $("#editSegmentList").append(newSegment);
            });
        }
    }
    var onloadFunc = function () {
        function thumbLoaded(e) {
            console.log("thumbLoaded");
            if (loaded_choices) {
                renderShots();
            }
            else {
                var loadedChoices = function () {
                    renderShots();
                };
                if (choice_list.length === 0)
                    on_loaded_choices = loadedChoices;
                else {
                    renderShots();
                    console.log("Rendering Shots");
                }
            }
        }
        //    video.playbackRate = 0.5;
        function pauseVideo(e) {
            curTime = video.currentTime;
            window.clearTimeout(timeoutVariable);
        }
        function playVideo(e) {
            var i = 0;
            //console.log("PLAYING VIDEO");
            curTime = video.currentTime;
            timeoutVariable = setInterval(myFunction, 1000.0 / 30.0);
            var segIndex = getSegmentIndex(curTime);
            //console.log(segIndex);
            //console.log("From beginning..." + segment_list[segIndex].begin + " + " + padTime(curTime));
            window.clearTimeout(e_nextSegmentTrigger);
            e_nextSegmentTrigger = window.setTimeout(nextSegment, 1000 * (extractTime(segment_list[segIndex].end) - curTime));
        }
        function nextEditSegment() { }
        function changeTimecode(e) {
        }
        function displayChapter(e) {
            //console.log("Display!");
            //            console.log(e);
            //            video.currentTime = (1*60+44);
            //            video_thumb.currentTime = (1*60+44);
        }
        function videoLoaded(e) {
            duration = video.duration;
            var curVideo = e.target;
            showTime(ctx, can, cursorTime, curTime, duration, segment_list);
        }
        // Load the choices
        $.getJSON("choices.json", function (data) {
            console.log("Loaded choices");
            loaded_choices = true;
            choice_list = data;
            if (on_loaded_choices != undefined) {
                on_loaded_choices(data);
            }
            else
                console.log("Undefined callback, doing nothing");
        });
        // Load the segments
        $.getJSON("segments.json", function (data) {
            console.log("Loaded segments");
            loaded_segments = true;
            segment_list = data;
        });
        /*        // Load beats (experimental)
                $.getJSON("/static/advancement/browser/beats.json", function (data) {
                  console.log("Loaded beats");
                  segment_list = data;
                });*/
        $.getJSON("dialogue.json", function (data) {
            console.log("Loaded dialogue");
            loaded_dialogue = true;
            dialogue_data = data;
            if (on_loaded_dialogue !== undefined)
                on_loaded_dialogue(data);
        });
        video = document.getElementById("myVideo");
        video_thumb = document.getElementById("thumbnail");
        $output = $("#output");
        $("#capture").click(captureImage);
        $("#nextFrameButton").click(nextFrameImage);
        var newCanvas = $("#timeline").get(0);
        newCanvas.width = $('body').innerWidth();
        newCanvas.height = 50;
        $("#shot_sequence").width($('body').innerWidth().toString() + "px");
        var editCanvas = $("#editTimeline").get(0);
        editCanvas.width = $('body').outerWidth();
        editCanvas.height = 50;
        can = document.getElementById("timeline");
        ctx = can.getContext("2d");
        e_can = document.getElementById("editTimeline");
        e_ctx = e_can.getContext("2d");
        can.addEventListener("mousedown", mouseDown, false);
        can.addEventListener("mousemove", mouseXY, false);
        can.addEventListener("touchstart", touchDown, false);
        can.addEventListener("touchmove", touchXY, true);
        can.addEventListener("touchend", touchUp, false);
        document.body.addEventListener("mouseup", mouseUp, false);
        document.body.addEventListener("touchcancel", touchUp, false);
        e_can.addEventListener("mousedown", mouseDown, false);
        e_can.addEventListener("mousemove", mouseXY, false);
        e_can.addEventListener("touchstart", touchDown, false);
        e_can.addEventListener("touchmove", touchXY, true);
        e_can.addEventListener("touchend", touchUp, false);
        curTime = video.currentTime;
        video.src = "source_1_medium.mp4";
        video_thumb.src = "source_1_tiny.mp4";
        video.addEventListener('timeupdate', changeTimecode, false);
        video.addEventListener('loadeddata', videoLoaded, false);
        video.addEventListener('loadedmetadata', function () {
            $("#videoParent").css("height", video.getBoundingClientRect().height);
            var textTrack = this.addTextTrack("subtitles", "English", "en");
            var onLoadDialogue = function (data) {
                var items = [];
                $.each(data, function (key, val) {
                    if (val.hasOwnProperty("begin")) {
                        var locutor = "";
                        var textClass = val.type;
                        if (val.hasOwnProperty("speaker")) {
                            locutor = val.speaker;
                        }
                        else if (val.hasOwnProperty("type")) {
                            locutor = val.type;
                        }
                        /*global VTTCue*/
                        textTrack.addCue(new VTTCue(extractTime(val.begin), extractTime(val.end), val.text));
                        var oldHtml = $("#script").html();
                        line_list[key] = val;
                        $('#script').html(oldHtml + "<p class='line " + val.type + "' id='line_" + val.lineid + "'><span class='speaker'>" + locutor.toUpperCase() + "</span><span class='lineText'>" + val.text + "</span></p>");
                    }
                });
                $(".line").mouseover(function (e) {
                    var curTarget = e.currentTarget;
                    cursorLine = parseInt(curTarget.id.split("_")[1]);
                });
                $(".line").mouseout(function (e) {
                    cursorLine = -1;
                });
                $(".line").click(function (e) {
                    var curTarget = e.currentTarget;
                    //console.log("CLICKED" + e.currentTarget.id);
                    //$(e.target).addClass("selected");
                    setTime(extractTime(line_list[curTarget.id.split("_")[1]].begin));
                    $(".line").removeClass("selected");
                    $(e.currentTarget).addClass("selected");
                    myPlayToggle(true);
                });
            };
            if (!loaded_dialogue) {
                on_loaded_dialogue = onLoadDialogue;
            }
            else {
                onLoadDialogue(dialogue_data);
            }
        });
        video.addEventListener('play', playVideo, false);
        video.addEventListener('pause', pauseVideo, false);
        video.load();
        video_thumb.addEventListener('loadeddata', thumbLoaded, false);
        video_thumb.load();
    };
    return { onloadFunc: onloadFunc };
}());
// Dean Edwards/Matthias Miller/John Resig
var _timer;
function init() {
    if (arguments.callee.done) {
        return;
    }
    arguments.callee.done = true;
    if (_timer) {
        clearInterval(_timer);
    }
    module.onloadFunc();
}
//# sourceMappingURL=engine.js.map