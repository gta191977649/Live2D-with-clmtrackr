/**
 * @license [traP Advent Calendar 2015 - Day22]
 * by traP TokyoTech (kaz)
 */

document.querySelector("#start").addEventListener("click", (function(window, document, navigator, alert, clm, pModel, Live2D, Live2DFramework, Live2DModelWebGL, PlatformManager){
	var live2dParams;

	//clmtrackrを初期化
	var initTracker = function(stream){
		var video = document.querySelector("#video");
		var tracker = new clm.tracker({useWebGL: true});

		//カメラから画像を取得しトラッキング開始
		video.src = window.URL.createObjectURL(stream);
		video.play();
		tracker.init(pModel);
		tracker.start(video);

		return tracker;
	};
	//clmtrackr描画開始
	var drawTracker = function(tracker){
		var stat = document.querySelector("#stat");
		var overlay = document.querySelector("#overlay");
		var ctx = overlay.getContext("2d");

		(function(){
			window.requestAnimationFrame(arguments.callee);

			//トラッキングした顔パーツ位置を描画
			ctx.clearRect(0, 0, overlay.width, overlay.height);
			tracker.draw(overlay);

			//Live2D用パラメータを計算して表示
			live2dParams = calculateParams(tracker);
			stat.textContent = JSON.stringify(live2dParams, null, 4);
		})();
	};
	//顔パーツの位置からLive2Dのパラメータを計算
	var calculateParams = function(tracker){
		var params = {SCORE: tracker.getScore()};
		var pos = tracker.getCurrentPosition();

		if(pos){
			var faceL = pos[62][0] - pos[2][0];
			var faceR = pos[12][0] - pos[62][0];
			var vecL = [pos[2][0] - pos[7][0], pos[2][1] - pos[7][1]];
			var vecR = [pos[12][0] - pos[7][0], pos[12][1] - pos[7][1]];
			var lipH = pos[53][1] - pos[57][1];
			var eyeHL = pos[26][1] - pos[24][1];
			var eyeHR = pos[31][1] - pos[29][1];

			//顔の向き
			params["PARAM_ANGLE_X"] = 90 * (faceL - faceR) / (faceL + faceR);
			params["PARAM_ANGLE_Y"] = -90 * (vecL[0] * vecR[0] + vecL[1] * vecR[1]) / Math.sqrt(vecL[0] * vecL[0] + vecL[1] * vecL[1]) / Math.sqrt(vecR[0] * vecR[0] + vecR[1] * vecR[1]);
			params["PARAM_ANGLE_Z"] = -90 * (pos[33][0] - pos[62][0]) / (pos[33][1] - pos[62][1]);

			//口の開閉・形
			params["PARAM_MOUTH_OPEN_Y"] = (pos[57][1] - pos[60][1]) / lipH - 0.5;
			params["PARAM_MOUTH_FORM"] = 2 * (pos[50][0] - pos[44][0]) / (pos[30][0] - pos[25][0]) - 1;

			//眼球の動き
			params["PARAM_EYE_BALL_X"] = (pos[27][0] - pos[23][0]) / (pos[25][0] - pos[23][0]) - 0.5;
			params["PARAM_EYE_BALL_Y"] = (pos[27][1] - pos[24][1]) / eyeHL - 0.5;

			//目の開閉
			params["PARAM_EYE_L_OPEN"] = 0.7 * eyeHL / lipH;
			params["PARAM_EYE_R_OPEN"] = 0.7 * eyeHR / lipH;

			//眉の上下
			params["PARAM_BROW_L_Y"] = 2 * (pos[24][1] - pos[21][1]) / lipH - 4;
			params["PARAM_BROW_R_Y"] = 2 * (pos[29][1] - pos[17][1]) / lipH - 4;
		}

		return params;
	};
	//Live2Dを初期化
	var initLive2D = function(callback){
		var _assetsDir = "assets";
		var _modelFile = _assetsDir + "/shizuku.moc";
		var _physicsFile = _assetsDir + "/shizuku.physics.json";
		var _textureFiles = [
			_assetsDir + "/shizuku.1024/texture_00.png",
			_assetsDir + "/shizuku.1024/texture_01.png",
			_assetsDir + "/shizuku.1024/texture_02.png",
			_assetsDir + "/shizuku.1024/texture_03.png",
			_assetsDir + "/shizuku.1024/texture_04.png"
		];

		var model;
		var phys;
		var loaded = 0;
		var gl = getWebGLContext();
		var pm = new PlatformManager();

		//初期化
		Live2D.init();
		Live2DFramework.setPlatformManager(pm);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);

		//モデル・物理演算データを読み込み
		pm.loadBytes(_modelFile, function(data){
			model = Live2DModelWebGL.loadModel(data);
			for(var i in _textureFiles){
				pm.loadTexture(model, i, _textureFiles[i], function(){ loaded++; })
			}
		});
		pm.loadBytes(_physicsFile, function(data){
			phys = L2DPhysics.load(data);
		});

		//読み込み終了後の処理
		(function(){
			if(model && phys && loaded == _textureFiles.length){
				//描画領域指定
				var s = 2.0 / model.getCanvasWidth();
				model.setMatrix([s,0,0,0 , 0,-s,0,0 , 0,0,1,0 , -1,1,0,1]);
				model.setGL(gl);

				//不要なパーツを非表示に
				model.setPartsOpacity("PARTS_01_ARM_L_02", 0);
				model.setPartsOpacity("PARTS_01_ARM_R_02", 0);

				callback(gl, model, phys);
			}else{
				setTimeout(arguments.callee, 100);
			}
		})();
	};
	//Live2D描画開始
	var drawLive2D = function(gl, model, phys){
		(function(){
			window.requestAnimationFrame(arguments.callee);

			//パラメータを適用・頂点移動・描画
			gl.clear(gl.COLOR_BUFFER_BIT);
			for(var paramName in live2dParams){
				model.setParamFloat(paramName, live2dParams[paramName]);
			}
			phys.updateParam(model);
			model.update();
			model.draw();
		})();
	};
	//CanvasのWebGLコンテキストを取得
	window.getWebGLContext = function(){
			var canvas = document.querySelector("#live2d");
			var ctxNames = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
			for(var i in ctxNames){
				var ctx = canvas.getContext(ctxNames[i], {
					alpha: true,
					premultipliedAlpha: true
				});
				if(ctx){
					return ctx;
				}
			}
			return null;
	};

	//開始関数
	return function(){
		//描画領域を表示
		document.querySelector("#container").style.display = document.querySelector("#live2d").style.display = "inline-block";

		//ベンダープレフィックスを外す
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
		window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
		window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

		//カメラにアクセス
		navigator.getUserMedia({video: true}, function(stream){
			initLive2D(drawLive2D);
			drawTracker(initTracker(stream));
		}, function(){
			alert("Failed to access camera");
		});
	};
})(window, document, navigator, alert, clm, pModel, Live2D, Live2DFramework, Live2DModelWebGL, PlatformManager));
