
(function($) { //scoping function to contain global variables

main();

function RenderTargets(gl) {

    this.initialize = function(width, height) {

        this.width = width || this.width || 0;
        this.height = height || this.height || 0;

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

        //var type = ( gl.getExtension('OES_texture_float') && gl.getExtension('OES_texture_float_linear') ) ? gl.FLOAT : gl.UNSIGNED_BYTE;

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
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

        var s = screenW / screenH;
        var b = bufferW / bufferH;

        if (s < b){

            var center = (this.left + this.right) / 2;
            var w = this.height() * (s / b);
            
            this.right = center + w / 2;
            this.left = center - w / 2;

            this.horizontalAspectRatio = s / b;
            this.verticalAspectRatio = 1;
        }
        else {

            var center = (this.bottom + this.top) / 2;
            var h = this.width() * (b / s);
            
            this.top = center + h / 2;
            this.bottom = center - h / 2;

            this.horizontalAspectRatio = 1;
            this.verticalAspectRatio = b / s;
        }
    };

    this.setPaintSize = function(value, power, scale) {
        this.paintSize = Math.pow(value, 3) / 1e+6;
    }

    this.getPaintSize = function() {
        return Math.pow(Math.min(this.width(), this.height()), 2) * this.paintSize;
    }
}

var gl, renderTargets;
var cellProgram, mouseProgram, screenProgram;
var params, surface;
var statsUi;

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
        mouseLastX: 0,
        mouseLastY: 0,

        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        zoomStep: 8,
        zoomLevel: 0,
        animate: true,

        paintSize: 0,
        paintColor: null,
        paintErase: false,
        paintSolid: false,
        paintPixel : false
    };

    var canvas =  document.getElementById('canvas');
    gl = canvas.getContext('webgl');

    renderTargets = new RenderTargets(gl);
    renderTargets.initialize(params.screenWidth, params.screenHeight);

    cellProgram = initCellProgram();
    mouseProgram = initMouseProgram();
    screenProgram = initScreenProgram();

    window.onresize = function() {

        params.screenWidth = window.innerWidth;
        params.screenHeight = window.innerHeight;

        surface.computeAspectRatio(params.screenWidth, params.screenHeight, renderTargets.width, renderTargets.height);

        canvas.width = params.screenWidth;
        canvas.height = params.screenHeight;
    };
    window.onresize();

    canvas.onmousemove = function(e) {

        params.mouseX = e.clientX / canvas.offsetWidth;
        params.mouseY = 1 - (e.clientY / canvas.offsetHeight);
    };

    canvas.onmousedown = function(e) {

        //left click
        if (e.which === 1){
             params.paintColor = HSVtoRGB (
                Math.random() * 360,
                ( Math.random() < 0.5 ? Math.random() : Math.random() / 2 + 0.5 ),
                1
            );
            mouseProgram.draw();
            canvas.addEventListener('mousemove', mouseProgram.draw)
        }
        //right click
        else if (e.which === 3){

            params.mouseLastX = params.mouseX;
            params.mouseLastY = params.mouseY;
            canvas.addEventListener('mousemove', panningHandler);
        }
    };

    canvas.onmouseup = function(e) {

        //left click
        if (e.which === 1) {
            canvas.removeEventListener('mousemove', mouseProgram.draw);
        }
        //right click
        else if (e.which === 3) {
            canvas.removeEventListener('mousemove', panningHandler);
        }
    };

    window.onkeydown = function(e) {

        if (e.which === 16) params.paintErase = true; //shift key
        if (e.which === 17) params.paintSolid = true; //ctrl key
    };

    window.onkeyup = function(e) {

        if (e.which === 16) params.paintErase = false; //shift key
        if (e.which === 17) params.paintSolid = false; //ctrl key
    };

    canvas.addEventListener('mousewheel', function(e) {
        zoomHandler(e.deltaY < 0 ? 1 : -1);
    });

    canvas.addEventListener('DOMMouseScroll', function(e){
        zoomHandler(e.detail < 0 ? 1 : -1);
    });

    function zoomHandler(wheel) {

        if ( (wheel == -1 && params.zoomLevel > 0) || (wheel == 1 && params.zoomLevel < params.zoomStep * 5) ) {
            
            params.zoomLevel += wheel;
            var scale =  1 / Math.exp( (params.zoomLevel + params.zoomStep) / params.zoomStep );

            var mx = params.mouseX - 0.5;
            var my = params.mouseY - 0.5;

            var width = surface.width();
            var height = surface.height();

            surface.top += height * my;
            surface.right += width * mx;
            surface.bottom += height * my;
            surface.left += width * mx;

            var centerX = (surface.left + surface.right) / 2;
            var centerY = (surface.bottom + surface.top) / 2;

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
        }
    }

    function panningHandler() {

        var dx = params.mouseLastX - params.mouseX;
        var dy = params.mouseLastY - params.mouseY;

        var width = surface.width(); 
        var height = surface.height();

        surface.top += height * dy;
        surface.right += width * dx;
        surface.bottom += height * dy;
        surface.left += width * dx;

        params.mouseLastX = params.mouseX;
        params.mouseLastY = params.mouseY;

        surface.normalize();
    }
}

function animate() {

    if (params.animate) {
        cellProgram.draw();
    }
    screenProgram.draw();
    statsUi.update();
    window.requestAnimationFrame(animate);
}

function initCellProgram() {

    var program = createProgram(gl, 'vertex-shader', 'cell-iteration-shader');

    var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution');
    var locTexture          = gl.getUniformLocation(program, 'u_buffer');
    var locRules            = gl.getUniformLocation(program, 'u_rules');

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(locTexture, 0);
    gl.uniform1i(locRules, 2)
    gl.useProgram(null);

    program.setRules = function(alive, dead) {

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
    };


    program.draw = function() {

        gl.viewport(0, 0, renderTargets.width, renderTargets.height);
        renderTargets.swap();

        gl.useProgram(program);
        gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };

    return program;
}

function initMouseProgram() {

    var program = createProgram(gl, 'vertex-shader', 'mouse-shader');

    var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution');
    var locMouse            = gl.getUniformLocation(program, 'u_mouse');
    var locPaintSize        = gl.getUniformLocation(program, 'u_paintSize');
    var locColor            = gl.getUniformLocation(program, 'u_color');
    var locPaintType        = gl.getUniformLocation(program, 'u_paintType');
    var locRandom           = gl.getUniformLocation(program, 'u_random');
    var locSurface          = gl.getUniformLocation(program, 'u_surface');
    var locTexture          = gl.getUniformLocation(program, 'u_buffer');

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(locTexture, 0);
    gl.useProgram(null);

    program.draw = function() {

        gl.viewport(0, 0, renderTargets.width, renderTargets.height);
        renderTargets.swap();

        gl.useProgram(program);
        gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
        gl.uniform2f(locMouse, params.mouseX, params.mouseY);
        gl.uniform4f(locColor, params.paintColor.r, params.paintColor.g, params.paintColor.b, 1.0);
        gl.uniform1iv(locPaintType, [params.paintPixel, params.paintErase, params.paintSolid]);
        gl.uniform1f(locPaintSize, surface.getPaintSize());
        gl.uniform1f(locRandom, Math.random());
        gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);  
    };

    return program;
}

function initScreenProgram() {

    var program = createProgram(gl, 'vertex-shader', 'screen-shader');

    var locSurface = gl.getUniformLocation(program, 'u_surface');
    var locTexture = gl.getUniformLocation(program, 'u_screenBuffer');

    // static uniforms
    gl.useProgram(program);
    gl.uniform1i(locTexture, 1);
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

    program.draw = function() {

        gl.viewport(0, 0, params.screenWidth, params.screenHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.useProgram(screenProgram);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, renderTargets.front.texture);
        gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };

    return program;
}

function Controller() {
        
    this.tWidth = renderTargets.width;
    this.tHeight = renderTargets.height;
    this.tCurrentWidth = this.tWidth;
    this.tCurrentHeight = this.tHeight;
    this.tMax = 10000;
    this.tMin = 250;
    this.tAspectRatio = true;

    this.paintSize = 5;

    this.activeRule = 0;
    this.alive = new Array(9);
    this.dead = new Array(9);

    this.clearScreen = function() {
        renderTargets.initialize();
    };

    this.togglePause = function() {
        params.animate = !params.animate;
    };

    this.setRules = function() {
        cellProgram.setRules(this.alive, this.dead);
    };

    this.updateTargets = function() {

        this.tCurrentWidth = this.tWidth;
        this.tCurrentHeight = this.tHeight;

        renderTargets.initialize(this.tWidth, this.tHeight);
        surface.computeAspectRatio(params.screenWidth, params.screenHeight, this.tWidth, this.tHeight);
    };

    this.setPaintSize = function(value) {
        
        params.paintPixel = (value === 0 ? true : false);
        surface.setPaintSize(value);
    };
    this.setPaintSize(this.paintSize);
}

function initGui() {

    statsUi = new Stats();
    statsUi.domElement.style.position = 'absolute';
    statsUi.domElement.style.left = '0px';
    statsUi.domElement.style.top = '0px';
    document.body.appendChild(statsUi.domElement);

    var gui = new dat.GUI();
    var presets = new RulePresets();
    var cont = new Controller();

    dat.GUI.prototype.updateDisplays = function() {
        for (var i in this.__controllers) {
            this.__controllers[i].updateDisplay();
        }
    };

    // main folder
    gui.add(cont, 'paintSize').min(0).max(25).step(1).name('Brush Size').onFinishChange(cont.setPaintSize);

    // gui.add(cont, 'family', {'Life': 0, 'Generations': 1}).name('Family');

    var iPresets = gui.add(cont, 'activeRule');
    iPresets.options(presets.getNames()).name('Preset').onChange(onPresetChange);

    var iAnimate = gui.add(cont, 'togglePause').name('Pause').onChange(onPauseToggle);
    iAnimate.paused = false;

    // rules folder
    var guiRules = gui.addFolder('Customize Rules');
    guiRulesAlive = guiRules.addFolder('Alive Cells');
    for (var i = 0; i < cont.alive.length; i++) {
        cont.alive[i] = false;
        guiRulesAlive.add(cont.alive, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }
    guiRulesDead = guiRules.addFolder('Dead Cells');
    for (var i = 0; i < cont.dead.length; i++) {
        cont.dead[i] = false;
        guiRulesDead.add(cont.dead, i).name(i + ' neighbors').onChange(cont.setRules.bind(cont));
    }

    // surface folder
    var guiSurface = gui.addFolder('Surface Properties');
    guiSurface.add(cont, 'clearScreen').name('Clear Screen');

    guiSurface.add(cont, 'tWidth').min(cont.tMin).max(cont.tMax).step(cont.tMin).name('Width')
                 .onChange(maintainAspectRatio).onFinishChange(cont.updateTargets.bind(cont));

    guiSurface.add(cont, 'tHeight').min(cont.tMin).max(cont.tMax).step(cont.tMin).name('Height')
                 .onChange(maintainAspectRatio).onFinishChange(cont.updateTargets.bind(cont));
    
    guiSurface.add(cont, 'tAspectRatio').name('Keep Ratio');

    onPresetChange(cont.activeRule);

    function onPauseToggle() {
        iAnimate.paused = !iAnimate.paused;
        iAnimate.name( iAnimate.paused ? 'Resume' : 'Pause');
    }

    function onPresetChange(index){

        rules = presets.getRule(index);

        for (var i = 0; i < rules.alive.length; i++) {
            guiRulesAlive.__controllers[i].setValue(rules.alive[i]);
        }
        for (var i = 0; i < rules.dead.length; i++) {
            guiRulesDead.__controllers[i].setValue(rules.dead[i]);
        }

        cont.setRules();
    }

    function maintainAspectRatio(value) {

        if (value && cont.tAspectRatio) {
            var ar = cont.tCurrentWidth / cont.tCurrentHeight;

            if (value == cont.tHeight) {
                cont.tWidth = Math.min(cont.tHeight * ar, cont.tMax);
                cont.tHeight = (cont.tWidth == cont.tMax ? cont.tWidth / ar : value);
            }
            else {
                cont.tHeight = Math.min(cont.tWidth / ar, cont.tMax);
                cont.tWidth = (cont.tHeight == cont.tMax ? cont.tHeight * ar : value);
            }

            guiSurface.updateDisplays();
        }
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

function HSVtoRGB(h, s, v){

    var c = v * s;
    var hp = h / 60;
    var x = c * (1 - Math.abs( hp % 2 - 1 ));

    var r, g, b;

    switch ( Math.floor(hp) ) {
        case 0: r = c, g = x, b = 0; break;
        case 1: r = x, g = c, b = 0; break;
        case 2: r = 0, g = c, b = x; break;
        case 3: r = 0, g = x, b = c; break;
        case 4: r = x, g = 0, b = c; break;
        case 5: r = c, g = 0, b = x; break;
    }

    var m = v - c;
    r += m, g += m, b += m;
    
    return {'r': r, 'g': g, 'b': b};
}

})();