
(function() { //scoping function to contain global variables

'use strict';
main();

function RenderTargets(gl) {

    this.initialize = function(width, height) {

        this.width = width || this.width;
        this.height = height || this.height;

        this.front = createTarget(this.width, this.height);
        this.back = createTarget(this.width, this.height);
    };

    this.swap = function() {

        var tmp = this.front;
        this.front = this.back;
        this.back = tmp;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.front.fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.back.texture);
    };

    function createTarget(width, height) {

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return { 'fbo': fbo, 'texture': texture };
    }
}

function Surface() {

    var oneToOneZoom;

    this.top = 1;
    this.right = 1;
    this.bottom = 0;
    this.left = 0;

    this.width = function() {
        return this.right - this.left;
    };

    this.height = function() {
        return this.top - this.bottom;
    };

    this.normalize = function() {

        this.top -= Math.floor(this.bottom);
        this.right -= Math.floor(this.left);
        this.bottom -= Math.floor(this.bottom);
        this.left -= Math.floor(this.left);
    };

    this.computeAspectRatio = function(screenW, screenH, bufferW, bufferH) {

        var s = screenW / screenH, 
            b = bufferW / bufferH;

        if (s < b){

            var center = (this.left + this.right) / 2,
                w = this.height() * (s / b);
            
            this.right = center + w / 2;
            this.left = center - w / 2;

            this.horizontalAspectRatio = s / b;
            this.verticalAspectRatio = 1;
        }
        else {

            var center = (this.bottom + this.top) / 2,
                h = this.width() * (b / s);
            
            this.top = center + h / 2;
            this.bottom = center - h / 2;

            this.horizontalAspectRatio = 1;
            this.verticalAspectRatio = b / s;
        }

        oneToOneZoom = screenW / bufferW;
    };

    this.isZoomedOut = function() {
        return this.width() > oneToOneZoom;
    };

    this.setBrushSize = function(value) {
        this.brushSize = Math.pow(value, 3) / 1e+5;
    };

    this.getBrushSize = function() {
        return Math.pow(Math.min(this.width(), this.height()), 2) * this.brushSize;
    };
}

var gl, renderTargets, canvas,
    cellProgram, mouseProgram, screenProgram,
    params, surface,
    statsUi;

function main() {

    init();
    initGui();
    animate();
}

function init() {

    surface = new Surface();
    params = {
        mouseX: 0,
        mouseY: 0,

        renderQuality: 1.5,
        zoomStep: 4,
        zoomLevel: 0,
        
        pauseCells: false,
        pauseOnDraw: false,
        pauseButton: false,

        brushSize: null,
        brushErase: false,
        brushSolid: false,
        brushPixel: false,

        paintColor: null,
        paintSaturation: 1,
        paintColorDecay: 1,

        cellStates: 1
    };

    canvas =  document.getElementById('canvas');
    gl = canvas.getContext('webgl');

    if (!gl){
        alert('Could not load WebGL');
    }

    renderTargets = new RenderTargets(gl);
    renderTargets.initialize(window.innerWidth, window.innerHeight);

    cellProgram = initCellProgram();
    mouseProgram = initMouseProgram();
    screenProgram = initScreenProgram();

    window.onresize = function() {

        surface.computeAspectRatio(window.innerWidth, window.innerHeight, renderTargets.width, renderTargets.height);
        adjustRenderQuality();
    };
    window.onresize();

    canvas.onmousemove = function(e) {

        params.mouseX = e.clientX / canvas.offsetWidth;
        params.mouseY = 1 - (e.clientY / canvas.offsetHeight);
    };

    canvas.onmousedown = function(e) {

        //left click
        if (e.which === 1){
            params.paintColor = {
                h: Math.random(),
                s: params.paintSaturation,
                v: 1
            };

            if (params.pauseOnDraw) {
                params.pauseCells = true;
            }
            mouseProgram.draw();
            canvas.addEventListener('mousemove', mouseProgram.draw);
        }
        //right click
        else if (e.which === 3){

            panningHandler.mouseLastX = params.mouseX;
            panningHandler.mouseLastY = params.mouseY;
            canvas.addEventListener('mousemove', panningHandler);
        }
    };

    canvas.onmouseup = function(e) {

        //left click
        if (e.which === 1) {

            if(params.pauseOnDraw && !params.pauseButton) {
                params.pauseCells = false;
            }
            canvas.removeEventListener('mousemove', mouseProgram.draw);
        }
        //right click
        else if (e.which === 3) {
            canvas.removeEventListener('mousemove', panningHandler);
        }
    };

    window.onkeydown = function(e) {

        if (e.which === 16) params.brushErase = true; //shift key
        if (e.which === 17) params.brushSolid = true; //ctrl key
    };

    window.onkeyup = function(e) {

        if (e.which === 16) params.brushErase = false; //shift key
        if (e.which === 17) params.brushSolid = false; //ctrl key
    };

    canvas.addEventListener('mousewheel', function(e) {
        zoomHandler(e.deltaY < 0 ? 1 : -1);
    });

    canvas.addEventListener('DOMMouseScroll', function(e){
        zoomHandler(e.detail < 0 ? 1 : -1);
    });

    function zoomHandler(wheel) {

        params.zoomLevel += wheel;

        if (params.zoomLevel < 0) params.zoomLevel++;
        else if (params.zoomLevel > params.zoomStep * 10) params.zoomLevel--;

        var scale = 0.5 * Math.pow(2, -params.zoomLevel / params.zoomStep);

        var mx = params.mouseX - 0.5,
            my = params.mouseY - 0.5,

            width = surface.width(),
            height = surface.height();

        surface.top += height * my;
        surface.right += width * mx;
        surface.bottom += height * my;
        surface.left += width * mx;

        var centerX = (surface.left + surface.right) / 2,
            centerY = (surface.bottom + surface.top) / 2;

        surface.top = centerY + scale * surface.verticalAspectRatio;
        surface.right = centerX + scale * surface.horizontalAspectRatio;
        surface.bottom = centerY - scale * surface.verticalAspectRatio;
        surface.left = centerX - scale * surface.horizontalAspectRatio;

        width = surface.width();
        height = surface.height();

        surface.top -= height * my;
        surface.right -= width * mx;
        surface.bottom -= height * my;
        surface.left -= width * mx;

        surface.normalize();
        adjustRenderQuality();
    }

    function panningHandler() {

        var dx = panningHandler.mouseLastX - params.mouseX,
            dy = panningHandler.mouseLastY - params.mouseY,
            
            width = surface.width(),
            height = surface.height();

        surface.top += height * dy;
        surface.right += width * dx;
        surface.bottom += height * dy;
        surface.left += width * dx;

        panningHandler.mouseLastX = params.mouseX;
        panningHandler.mouseLastY = params.mouseY;

        surface.normalize();
    }
}

function adjustRenderQuality() {

    var quality = surface.isZoomedOut() ? params.renderQuality : 1;
    canvas.width = window.innerWidth * quality;
    canvas.height = window.innerHeight * quality;
}

function animate() {

    if (!params.pauseCells) {
        cellProgram.draw();
    }
    screenProgram.draw();
    statsUi.update();
    window.requestAnimationFrame(animate);
}

function initCellProgram() {

    var program, uniforms;

    function createCellProgram(shaderId){

        var program = createProgram(gl, 'vertex-shader', shaderId);
        uniforms = getUniformLocations(gl, program, ['u_bufferResolution', 'u_colorDecay', 'u_cellStates']);

        // static uniforms
        gl.useProgram(program);
        gl.uniform1i(gl.getUniformLocation(program, 'u_buffer'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'u_rules'), 2);
        gl.useProgram(null);

        return program;
    }

    return {
        draw: function() {

            gl.viewport(0, 0, renderTargets.width, renderTargets.height);
            renderTargets.swap();

            gl.useProgram(program);
            gl.uniform2f(uniforms.u_bufferResolution, renderTargets.width, renderTargets.height);
            gl.uniform1f(uniforms.u_colorDecay, params.paintColorDecay);
            gl.uniform1i(uniforms.u_cellStates, params.cellStates);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        },

        setRules: function(alive, dead) {

            var data = [];
            for (var i = 0; i < alive.length; i++){
                data.push(alive[i] * 255, dead[i] * 255, 0, 0);
            }
            var texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, alive.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data));
        },

        useLifeProgram: function() {
            program = createCellProgram('cell-life-shader');
        },

        useGenerationsProgram: function() {
            program = createCellProgram('cell-generations-shader');
        }
    };
}

function initMouseProgram() {

    var program = createProgram(gl, 'vertex-shader', 'mouse-shader'),
        uniforms = getUniformLocations(gl, program, 
            ['u_bufferResolution', 'u_mouse', 'u_brushSize', 'u_color', 'u_brushErase', 
             'u_brushSolid', 'u_brushPixel', 'u_colorDecay', 'u_random', 'u_surface']);

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_buffer'), 0);
    gl.useProgram(null);

    return {
        draw: function() {

            gl.viewport(0, 0, renderTargets.width, renderTargets.height);
            renderTargets.swap();

            gl.useProgram(program);
            gl.uniform2f(uniforms.u_bufferResolution, renderTargets.width, renderTargets.height);
            gl.uniform2f(uniforms.u_mouse, params.mouseX, params.mouseY);
            gl.uniform4f(uniforms.u_color, params.paintColor.h, params.paintColor.s, params.paintColor.v, 1.0);
            gl.uniform1i(uniforms.u_brushErase, params.brushErase);
            gl.uniform1i(uniforms.u_brushSolid, params.brushSolid);
            gl.uniform1i(uniforms.u_brushPixel, params.brushPixel);
            gl.uniform1f(uniforms.u_brushSize, surface.getBrushSize());
            gl.uniform1f(uniforms.u_colorDecay, params.paintColorDecay);
            gl.uniform1f(uniforms.u_random, Math.random());
            gl.uniform4f(uniforms.u_surface, surface.top, surface.right, surface.bottom, surface.left);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);  
        }
    };
}

function initScreenProgram() {

    var program = createProgram(gl, 'vertex-shader', 'screen-shader'),
        uniforms = getUniformLocations(gl, program, ['u_surface']);

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_screenBuffer'), 1);
    gl.useProgram(null);

    var locVertexCoords = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(locVertexCoords);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.vertexAttribPointer(locVertexCoords, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,
        0, 1,
        1, 1,
        1, 0]), gl.STATIC_DRAW);

    return {
        draw: function() {

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            gl.useProgram(program);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, renderTargets.front.texture);
            gl.uniform4f(uniforms.u_surface, surface.top, surface.right, surface.bottom, surface.left);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
    };
}

function Controller() {
        
    this.tWidth = renderTargets.width;
    this.tHeight = renderTargets.height;
    this.tMin = 200;
    this.tMax = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) - this.tMin, 12000);
    this.tAspectRatio = true;

    this.brushSize = 4;

    this.activeFamily = 0;
    this.activePreset = 0;
    this.alive = [false, false, false, false, false, false, false, false, false];
    this.dead = [false, false, false, false, false, false, false, false, false];

    this.togglePause = function() {
        params.pauseCells = !params.pauseCells;
        params.pauseButton = !params.pauseButton;
    };

    this.setRules = function() {
        cellProgram.setRules(this.alive, this.dead);
    };

    this.changeCellProgram = function(value) {
        if (value === 0) cellProgram.useLifeProgram();
        else cellProgram.useGenerationsProgram();
    };

    this.updateTargets = function() {
        renderTargets.initialize(this.tWidth, this.tHeight);
        window.onresize();
    };

    this.setBrushSize = function(value) {
        
        params.brushPixel = (value === 0 ? true : false);
        surface.setBrushSize(value);
    };

    this.setBrushSize(this.brushSize);
}

function initGui() {

    statsUi = new Stats();
    statsUi.domElement.style.position = 'absolute';
    statsUi.domElement.style.left = '0px';
    statsUi.domElement.style.top = '0px';
    document.body.appendChild(statsUi.domElement);

    var gui = new dat.GUI(),
        presets = new RulePresets(),
        cont = new Controller();

    dat.GUI.prototype.updateDisplays = function() {
        for (var i in this.__controllers) {
            this.__controllers[i].updateDisplay();
        }
    };

    // main folder
    gui.add(cont, 'brushSize', 0, 20).step(1).name('Brush Size').onFinishChange(cont.setBrushSize);
    gui.add(params, 'paintColorDecay', 0, 1).name('Color Decay');
    gui.add(params, 'paintSaturation', 0, 1).name('Paint Saturation');
    gui.add(cont, 'activeFamily', {'Life': 0, 'Generations': 1}).name('Family').onChange(onFamilyChange);
    var iPreset = gui.add(cont, 'activePreset');
    var iAnimate = gui.add(cont, 'togglePause').name('Pause').onChange(onPauseToggle);
    gui.add(params, 'pauseOnDraw').name('Pause On Draw');
    gui.add(cont, 'updateTargets').name('Clear Screen');

    // rules folder
    var guiRules = gui.addFolder('Customize Rules');
    var iGenerations = guiRules.add(params, 'cellStates', 2, 50).step(1).name('Cell States');
    var guiRulesAlive = guiRules.addFolder('Alive Cells');
    var guiRulesDead = guiRules.addFolder('Dead Cells');
    for (var i = 0; i < cont.alive.length; i++) {
        guiRulesAlive.add(cont.alive, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }
    for (var i = 1; i < cont.dead.length; i++) {
        guiRulesDead.add(cont.dead, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }

    onFamilyChange(cont.activeFamily);
    onPresetChange(cont.activePreset);

    // surface folder
    var guiSurface = gui.addFolder('Surface Properties');
    guiSurface.add(params, 'renderQuality', {'Low': 1, 'Medium': params.renderQuality, 'High': 2}).name('Render Quality').onChange(adjustRenderQuality);
    guiSurface.add(cont, 'tWidth', cont.tMin, cont.tMax).step(cont.tMin).name('Width')
              .onChange(maintainAspectRatio).onFinishChange(cont.updateTargets.bind(cont));
    guiSurface.add(cont, 'tHeight', cont.tMin, cont.tMax).step(cont.tMin).name('Height')
              .onChange(maintainAspectRatio).onFinishChange(cont.updateTargets.bind(cont));
    guiSurface.add(cont, 'tAspectRatio').name('Screen Ratio');

    function onPauseToggle() {
        iAnimate.name(iAnimate.__li.textContent == 'Pause' ? 'Resume' : 'Pause');
    }

    function onFamilyChange(value) {
        if (value === 0){
            presets.setFamilyLife();
            iGenerations.__li.style.display = 'none';
            params.paintSaturation = 0.8;
            params.paintColorDecay = 0.2;
        }
        else {
            presets.setFamilyGenerations();
            iGenerations.__li.style.display = '';
            params.paintSaturation = 0.3;
            params.paintColorDecay = 0.4;
        }

        gui.updateDisplays();
        cont.activePreset = 0;
        iPreset = iPreset.options(presets.getNames()).name('Preset').onChange(onPresetChange);
        iPreset.__select.selectedIndex = cont.activePreset;
        onPresetChange(cont.activePreset);
        cont.changeCellProgram(value);
    }

    function onPresetChange(index) {

        var rule = presets.getRule(index);

        for (var i = 0; i < rule.alive.length; i++) {
            guiRulesAlive.__controllers[i].setValue(rule.alive[i]);
        }
        for (var i = 0; i < rule.dead.length - 1; i++) {
            guiRulesDead.__controllers[i].setValue(rule.dead[i + 1]);
        }

        if (rule.cellStates) {
            params.cellStates = rule.cellStates;
            iGenerations.updateDisplay();
        }

        cont.setRules();
    }

    function maintainAspectRatio(value) {

        if (cont.tAspectRatio) {
            var ar = window.innerWidth / window.innerHeight;

            if (value == cont.tHeight) {
                cont.tWidth = Math.min(cont.tHeight * ar, cont.tMax);
                cont.tHeight = cont.tWidth == cont.tMax ? cont.tWidth / ar : value;
            }
            else {
                cont.tHeight = Math.min(cont.tWidth / ar, cont.tMax);
                cont.tWidth = cont.tHeight == cont.tMax ? cont.tHeight * ar : value;
            }

            guiSurface.updateDisplays();
        }
    }
}

function createProgram(gl, vertexShaderID, fragmentShaderID, params) {

    function compileAndCheck(program, shader, source) {
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log(gl.getShaderInfoLog(shader));
        }
        gl.attachShader(program, shader);
    }

    var program = gl.createProgram();

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    compileAndCheck(program, vertexShader, document.getElementById(vertexShaderID).innerHTML);

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    compileAndCheck(program, fragmentShader, document.getElementById(fragmentShaderID).innerHTML);

    gl.linkProgram(program);

    return program;
}

function getUniformLocations(gl, program, uniformNames) {
    var uniforms = [];
    for (var i = 0; i < uniformNames.length; i++) {
        uniforms[uniformNames[i]] = gl.getUniformLocation(program, uniformNames[i]);
    }
    return uniforms;
}

})();