
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
        paintSaturation: 0.9,
        paintColorDecay: 0.2

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

        if ( (wheel == -1 && params.zoomLevel > 0) || (wheel == 1 && params.zoomLevel < params.zoomStep * 10) ) {
            
            params.zoomLevel += wheel;
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

    var program = createProgram(gl, 'vertex-shader', 'cell-iteration-shader');

    var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution'),
        locColorDecay       = gl.getUniformLocation(program, 'u_colorDecay');

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_buffer'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_rules'), 2);
    gl.useProgram(null);

    return {
        draw: function() {

            gl.viewport(0, 0, renderTargets.width, renderTargets.height);
            renderTargets.swap();

            gl.useProgram(program);
            gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
            gl.uniform1f(locColorDecay, params.paintColorDecay);
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
        }
    };
}

function initMouseProgram() {

    var program = createProgram(gl, 'vertex-shader', 'mouse-shader');

    var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution'),
        locMouse            = gl.getUniformLocation(program, 'u_mouse'),
        locBrushSize        = gl.getUniformLocation(program, 'u_brushSize'),
        locColor            = gl.getUniformLocation(program, 'u_color'),
        locBrushErase       = gl.getUniformLocation(program, 'u_brushErase'),
        locBrushSolid       = gl.getUniformLocation(program, 'u_brushSolid'),
        locBrushPixel       = gl.getUniformLocation(program, 'u_brushPixel'),
        locColorDecay       = gl.getUniformLocation(program, 'u_colorDecay'),
        locRandom           = gl.getUniformLocation(program, 'u_random'),
        locSurface          = gl.getUniformLocation(program, 'u_surface');

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_buffer'), 0);
    gl.useProgram(null);

    return {
        draw: function() {

            gl.viewport(0, 0, renderTargets.width, renderTargets.height);
            renderTargets.swap();

            gl.useProgram(program);
            gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
            gl.uniform2f(locMouse, params.mouseX, params.mouseY);
            gl.uniform4f(locColor, params.paintColor.h, params.paintColor.s, params.paintColor.v, 1.0);
            gl.uniform1i(locBrushErase, params.brushErase);
            gl.uniform1i(locBrushSolid, params.brushSolid);
            gl.uniform1i(locBrushPixel, params.brushPixel);
            gl.uniform1f(locBrushSize, surface.getBrushSize());
            gl.uniform1f(locColorDecay, params.paintColorDecay);
            gl.uniform1f(locRandom, Math.random());
            gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);  
        }
    };
}

function initScreenProgram() {

    var program = createProgram(gl, 'vertex-shader', 'screen-shader');

    var locSurface = gl.getUniformLocation(program, 'u_surface');

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
            gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
    };
}

function Controller() {
        
    this.tWidth = renderTargets.width;
    this.tHeight = renderTargets.height;
    this.tMax = 10000;
    this.tMin = 250;
    this.tAspectRatio = true;

    this.brushSize = 4;

    this.activeRule = 0;
    this.alive = [false, false, false, false, false, false, false, false, false];
    this.dead = [false, false, false, false, false, false, false, false, false];

    this.clearScreen = function() {
        renderTargets.initialize();
    };

    this.togglePause = function() {
        params.pauseCells = !params.pauseCells;
        params.pauseButton = !params.pauseButton;
    };

    this.setRules = function() {
        cellProgram.setRules(this.alive, this.dead);
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

    gui.add(cont, 'activeRule', presets.getNames()).name('Preset').onChange(onPresetChange);

    gui.add(params, 'pauseOnDraw').name('Pause On Draw');

    var iAnimate = gui.add(cont, 'togglePause').name('Pause').onChange(onPauseToggle);

    // rules folder
    var guiRules = gui.addFolder('Customize Rules');
    var guiRulesAlive = guiRules.addFolder('Alive Cells');
    var guiRulesDead = guiRules.addFolder('Dead Cells');
    for (var i = 0; i < cont.alive.length; i++) {
        guiRulesAlive.add(cont.alive, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }
    for (var i = 1; i < cont.dead.length; i++) {
        guiRulesDead.add(cont.dead, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }

    // surface folder
    var guiSurface = gui.addFolder('Surface Properties');
    guiSurface.add(cont, 'clearScreen').name('Clear Screen');

    guiSurface.add(params, 'renderQuality', {'Low': 1, 'Medium': 1.5, 'High': 2}).name('Render Quality').onChange(adjustRenderQuality);

    guiSurface.add(cont, 'tWidth', cont.tMin, cont.tMax).step(cont.tMin).name('Width')
              .onChange(maintainAspectRatio).onFinishChange(onSurfaceDimensionChanged);

    guiSurface.add(cont, 'tHeight', cont.tMin, cont.tMax).step(cont.tMin).name('Height')
              .onChange(maintainAspectRatio).onFinishChange(onSurfaceDimensionChanged);
    
    guiSurface.add(cont, 'tAspectRatio').name('Keep Ratio');

    var currentAspectRatio = cont.tWidth / cont.tHeight;

    onPresetChange(cont.activeRule);

    function onPauseToggle() {
        iAnimate.name(iAnimate.__li.textContent == 'Pause' ? 'Resume' : 'Pause');
    }

    function onPresetChange(index){

        var rule = presets.getRule(index);

        for (var i = 0; i < rule.alive.length; i++) {
            guiRulesAlive.__controllers[i].setValue(rule.alive[i]);
        }
        for (var i = 0; i < rule.dead.length - 1; i++) {
            guiRulesDead.__controllers[i].setValue(rule.dead[i + 1]);
        }

        cont.setRules();
    }

    function maintainAspectRatio(value) {

        if (cont.tAspectRatio) {
            var ar = currentAspectRatio;

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

    function onSurfaceDimensionChanged() {
        currentAspectRatio = cont.tWidth / cont.tHeight;
        cont.updateTargets();
    }
}

function createProgram(gl, vertexShaderID, fragmentShaderID) {

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, document.getElementById(vertexShaderID).innerHTML);
    gl.compileShader(vertexShader);

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, document.getElementById(fragmentShaderID).innerHTML);
    gl.compileShader(fragmentShader);

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    return program;
}

})();