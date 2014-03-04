
(function($) { //scoping function to contain global variables

    $(document).ready(main);

    function ScreenSize() {

        this.width = $(window).width();
        this.height = $(window).height() - 5;
    }

    function RenderTargets(gl) {

        this.initialize = function(width, height) {

            this.width = width || this.width || 0;
            this.height = height || this.height || 0;

            this.front = this.createTarget();
            this.back = this.createTarget();
        };

        this.swap = function() {

            var tmp = this.front;
            this.front = this.back;
            this.back = tmp;

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.front.fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.back.texture);
        };

        this.createTarget = function() {

            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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
    }

    Surface.prototype.width = function() {
        return this.right - this.left;
    };

    Surface.prototype.height = function() {
        return this.top - this.bottom;
    };

    Surface.prototype.normalize = function() {

        this.top -= Math.floor(this.bottom);
        this.right -= Math.floor(this.left);
        this.bottom -= Math.floor(this.bottom);
        this.left -= Math.floor(this.left);
    };

    Surface.prototype.computeAspectRatio = function(screenW, screenH, bufferW, bufferH) {

        var s = screenW / screenH;
        var b = bufferW / bufferH;

        if (s < b){
            var center = this.left + this.width() / 2;
            var w = this.height() * (s / b) / 2;
            
            this.right = center + w;
            this.left = center - w;
        }
        else {
            var center = this.bottom + this.height() / 2;
            var h = this.width() * (b / s) / 2;
            
            this.top = center + h;
            this.bottom = center - h;
        }

        this.scaleConstant = screenW / bufferW;
        this.horizontalAspectRatio = s / b;
    };

    Surface.prototype.setPaintSize = function(value) {
        this.paintSize = Math.pow(value, 3) / 1000000;
    }

    Surface.prototype.getPaintSize = function() {
        return this.width() * this.paintSize;
    };

    Surface.prototype.setPaintColor = function(h, s, v) {
        var c = v * s;
        var hp = h / 60;
        var x = c * (1 - Math.abs( hp % 2 - 1 ))
        
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
        
        this.paintColor = {'r': r, 'g': g, 'b': b}
    };

    function MouseProp() {

        this.x = 0;
        this.y = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.leftClick = false;
        this.rightClick = false;
    }

    var gl, renderTargets;
    var cellProgram, mouseProgram, screenProgram;
    var screenSize, mouseProp, surface;
    var statsUi;

    function main() {

        init();
        initGui();
        animate();
    }

    function init() {

        screenSize = new ScreenSize();
        mouseProp = new MouseProp();
        surface = new Surface();

        var canvas =  $('canvas');
        gl = canvas[0].getContext('webgl');

        renderTargets = new RenderTargets(gl);
        renderTargets.initialize(screenSize.width, screenSize.height);

        cellProgram = initCellProgram();
        mouseProgram = initMouseProgram();
        screenProgram = initScreenProgram();

        $(window).resize(function(event) {
            screenSize = new ScreenSize();

            surface.computeAspectRatio(screenSize.width, screenSize.height, renderTargets.width, renderTargets.height);

            canvas.prop('width', screenSize.width);
            canvas.prop('height', screenSize.height);
        });
        $(window).trigger('resize');

        canvas.mousemove(function(event) {

            mouseProp.x = event.pageX;
            mouseProp.y = screenSize.height - event.pageY;
        });

        canvas.mousedown(function(event) {

            //left click
            if (event.which === 1){
                 mouseProp.leftClick = true;
                 surface.setPaintColor (
                    Math.random() * 360,
                    ( Math.random() * 2 < 1 ? Math.random() : Math.random() / 2 + 0.5 ),
                    Math.random() / 5 + 0.8
                )
            }

            //right click
            else if (event.which === 3){
                mouseProp.rightClick = true;
                mouseProp.lastX = mouseProp.x;
                mouseProp.lastY = mouseProp.y;

                canvas.bind('mousemove', panningHandler);
            }
       
        });

        canvas.mouseup(function(event) {

            //left click
            if (event.which === 1){
                 mouseProp.leftClick = false;
            }

            //right click
            else if (event.which === 3){
                mouseProp.rightClick = false;
                canvas.unbind('mousemove', panningHandler);
            }
        });

        function panningHandler(event) {

            var changeX = mouseProp.lastX - mouseProp.x;
            var changeY = mouseProp.lastY - mouseProp.y;

            var dx = surface.width() / screenSize.width; 
            var dy = surface.height() / screenSize.height;

            surface.top += dy * changeY;
            surface.right += dx * changeX;
            surface.bottom += dy * changeY;
            surface.left += dx * changeX;

            surface.normalize();

            mouseProp.lastX = mouseProp.x;
            mouseProp.lastY = mouseProp.y;
        }

        canvas.mousewheel(function(event) {

            var maxScale = 1;
            var minScale = 0.05;
            var scaleStep = 0.05 * event.deltaY;

            var width = surface.width();
            var height = surface.height();

            if ( (event.deltaY === 1 && Math.min(width, height) > minScale * surface.scaleConstant) || (event.deltaY === -1 && Math.max(width, height) < maxScale) ) {

                mx = mouseProp.x / screenSize.width;
                my = mouseProp.y / screenSize.height;

                var dx = surface.left + mx * width - (surface.left + width / 2);
                var dy = surface.bottom + my * height - (surface.bottom + height / 2);

                // scale the surface centered around the mouse location
                surface.top += dy - height * scaleStep;
                surface.right += dx - width * scaleStep;
                surface.bottom += dy + height * scaleStep;
                surface.left += dx + width * scaleStep;

                width = surface.width();
                height = surface.height();

                dx = surface.left + mx * width - (surface.left + width / 2);
                dy = surface.bottom + my * height - (surface.bottom + height / 2);

                // translate the surface back so that the mouse location is in the original area on screen
                surface.top -= dy;
                surface.right -= dx;
                surface.bottom -= dy;

                // recalculate the left side according to the aspect ratio to guarantee correct proportions
                var width = surface.height() * surface.horizontalAspectRatio;
                surface.left = surface.right - width;

                surface.normalize();
            }
        });
    }

    function drawScene() {
        // front buffer
        gl.viewport(0, 0, renderTargets.width, renderTargets.height);

        renderTargets.swap();
        gl.useProgram(cellProgram);
        cellProgram.setUniformValues();
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        if (mouseProp.leftClick) {

            renderTargets.swap();
            gl.useProgram(mouseProgram);
            mouseProgram.setUniformValues();
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }

        // screen buffer
        gl.viewport(0, 0, screenSize.width, screenSize.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, renderTargets.front.texture);
        
        gl.useProgram(screenProgram);
        screenProgram.setUniformValues();
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    }

    function initCellProgram() {

        var program = createProgram('#vertex-shader', '#cell-iteration-shader');

        var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution');
        var locTexture          = gl.getUniformLocation(program, 'u_buffer');
        var locRules            = gl.getUniformLocation(program, 'u_rules');

        // static uniforms
        gl.useProgram(program);
        gl.uniform1i(locTexture, 0);
        gl.uniform1i(locRules, 2)
        gl.useProgram(null);

        program.setUniformValues = function() {
        
            gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
        };

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

        return program;
    }

    function initMouseProgram() {

        var program = createProgram('#vertex-shader', '#mouse-shader');

        var locBufferResolution = gl.getUniformLocation(program, 'u_bufferResolution');
        var locMouse            = gl.getUniformLocation(program, 'u_mouse');
        var locColor            = gl.getUniformLocation(program, 'u_color');
        var locPaintSize        = gl.getUniformLocation(program, 'u_paintSize');
        var locSurface          = gl.getUniformLocation(program, 'u_surface');
        var locTexture          = gl.getUniformLocation(program, 'u_buffer');

        // static uniforms
        gl.useProgram(program);
        gl.uniform1i(locTexture, 0);
        gl.useProgram(null);

        // dynamic uniforms
        program.setUniformValues = function() {
            
            gl.uniform2f(locBufferResolution, renderTargets.width, renderTargets.height);
            gl.uniform2f(locMouse, mouseProp.x / screenSize.width, mouseProp.y / screenSize.height);
            gl.uniform4f(locColor, surface.paintColor.r, surface.paintColor.g, surface.paintColor.b, 1.0);
            gl.uniform1f(locPaintSize, surface.getPaintSize());
            gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);
        };

        return program;
    }

    function initScreenProgram() {

        var program = createProgram('#vertex-shader', '#screen-shader');

        var locSurface = gl.getUniformLocation(program, 'u_surface');
        var locTexture = gl.getUniformLocation(program, 'u_screenBuffer');

        // static uniforms
        gl.useProgram(program);
        gl.uniform1i(locTexture, 1);
        gl.useProgram(null);

        // dynamic uniforms
        program.setUniformValues = function() {
            gl.uniform4f(locSurface, surface.top, surface.right, surface.bottom, surface.left);
        };

        var locVertexCoords = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(locVertexCoords);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.vertexAttribPointer(locVertexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,
            0, 1,
            1, 1,
            1, 0]), gl.STATIC_DRAW);

        return program;
    }

    function createProgram(vertexShaderID, fragmentShaderID) {

        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, $(vertexShaderID).text());
        gl.compileShader(vertexShader);

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, $(fragmentShaderID).text());
        gl.compileShader(fragmentShader);

        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        return program;
    }

    function animate() {

        drawScene();
        statsUi.update();
        window.requestAnimationFrame(animate);
    }

    function Controller() {
            
        this.tWidth = renderTargets.width;
        this.tHeight = renderTargets.height;
        this.tMax = 7000;
        this.tMin = 200;
        this.tAspectRatio = true;

        this.paintSize = 6;
        surface.setPaintSize(this.paintSize);

        this.activeRule = 0;

        this.alive = new Array(9);
        this.dead = new Array(9);

        this.clearScreen = function() {
            renderTargets.initialize();
        };
    }

    function initGui() {

        statsUi = new Stats();
        statsUi.domElement.style.position = 'absolute';
        statsUi.domElement.style.left = '0px';
        statsUi.domElement.style.top = '0px';
        document.body.appendChild(statsUi.domElement);

        var gui = new dat.GUI();
        var controller = new Controller();
        var presets = new RulePresets();

        dat.GUI.prototype.updateDisplays = function() {
            for (var i in this.__controllers) {
                this.__controllers[i].updateDisplay();
            }
        };

        gui.add(controller, 'paintSize', 1, 25).step(1).name('Brush Size').onFinishChange(onPaintSizeChange);
        gui.add(controller, 'activeRule', presets.getNames()).name('Preset').onChange(onPresetChange);
        gui.add(controller, 'clearScreen').name('Clear Screen');

        var guiRules = gui.addFolder('Life Rules');

        guiRulesAlive = guiRules.addFolder('Alive Cells');
        for (var i = 0; i < controller.alive.length; i++) {
            controller.alive[i] = false;
            guiRulesAlive.add(controller.alive, i).name(i + ' neighbors').onChange(onRulesChange);
        }

        guiRulesDead = guiRules.addFolder('Dead Cells');
        for (var i = 0; i < controller.dead.length; i++) {
            controller.dead[i] = false;
            guiRulesDead.add(controller.dead, i).name(i + ' neighbors').onChange(onRulesChange);
        }

        var guiResolution = gui.addFolder('Surface Properties');
        guiResolution.add(controller, 'tWidth').min(controller.tMin).max(controller.tMax).step(controller.tMin).name('Width').onChange(maintainAspectRatio).onFinishChange(updateBuffers);
        guiResolution.add(controller, 'tHeight').min(controller.tMin).max(controller.tMax).step(controller.tMin).name('Height').onChange(maintainAspectRatio).onFinishChange(updateBuffers);
        guiResolution.add(controller, 'tAspectRatio').name('Keep Ratio');

        onPresetChange(controller.activeRule);

        function onPaintSizeChange(value) {
            surface.setPaintSize(value);
        }

        function onPresetChange(index){

            rules = presets.getRule(index);

            for (var i = 0; i < rules.alive.length; i++) {
                controller.alive[i] = rules.alive[i];
            }
            for (var i = 0; i < rules.dead.length; i++) {
                controller.dead[i] = rules.dead[i];
            }

            guiRulesAlive.updateDisplays();
            guiRulesDead.updateDisplays();
            onRulesChange();
        }

        function onRulesChange() {
            cellProgram.setRules(controller.alive, controller.dead);
        }

        function maintainAspectRatio(value) {

            if (controller.tAspectRatio) {
                var ar = renderTargets.width / renderTargets.height;

                if (value == controller.tHeight){
                    controller.tWidth = Math.min(controller.tHeight * ar, controller.tMax);
                    controller.tHeight = (controller.tWidth == controller.tMax ? controller.tWidth / ar : value);
                }
                else {
                    controller.tHeight = Math.min(controller.tWidth / ar, controller.tMax);
                    controller.tWidth = (controller.tHeight == controller.tMax ? controller.tHeight * ar : value);
                }

                guiResolution.updateDisplays();
            }
        }

        function updateBuffers() {

            renderTargets.initialize(controller.tWidth, controller.tHeight);
            surface.computeAspectRatio(screenSize.width, screenSize.height, renderTargets.width, renderTargets.height);
        }
    }

})(jQuery);