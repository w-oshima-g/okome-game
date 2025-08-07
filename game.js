class OkomeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.gameRunning = true;
        this.nextDogType = 1;
        this.canDrop = true;
        this.gameLoopRunning = false;
        this.droppedDogs = new Set(); // 落下中の犬を追跡
        this.mouseX = 200; // マウスX座標を保存
        
        this.dogTypes = [
            { type: 1, width: 20, height: 24, image: null, score: 1 },
            { type: 2, width: 26, height: 31, image: null, score: 3 },
            { type: 3, width: 34, height: 41, image: null, score: 6 },
            { type: 4, width: 44, height: 53, image: null, score: 10 },
            { type: 5, width: 57, height: 68, image: null, score: 15 },
            { type: 6, width: 74, height: 89, image: null, score: 21 },
            { type: 7, width: 96, height: 115, image: null, score: 28 },
            { type: 8, width: 125, height: 150, image: null, score: 36 },
            { type: 9, width: 162, height: 194, image: null, score: 45 },
            { type: 10, width: 211, height: 253, image: null, score: 55 },
            { type: 11, width: 274, height: 329, image: null, score: 66 }
        ];
        
        this.previewImage = new Image();
        
        this.init();
    }
    
    async init() {
        console.log('Initializing game...');
        await this.loadImages();
        this.setupPhysics();
        this.setupEvents();
        // 初期の犬を作成
        this.createNextDog(this.mouseX);
        this.gameLoop();
        console.log('Game initialization complete');
    }
    
    async loadImages() {
        // 全ての画像を同期的に読み込み（UI表示のため）
        const loadPromises = this.dogTypes.map((dogType, index) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    dogType.image = img;
                    console.log(`Loaded image: okome${dogType.type}.png`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load image: okome${dogType.type}.png`);
                    resolve();
                };
                img.src = `image/okome${dogType.type}.png`;
            });
        });
        
        await Promise.all(loadPromises);
        console.log('All images loaded successfully');
        
        // 読み込み完了後にUIを更新
        this.updateNextPreview();
        this.createGrowthCircle();
    }
    
    loadSingleImage(dogType) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                dogType.image = img;
                console.log(`Single image loaded: okome${dogType.type}.png`);
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load single image: okome${dogType.type}.png`);
                resolve();
            };
            img.src = `image/okome${dogType.type}.png`;
        });
    }
    
    setupPhysics() {
        const Engine = Matter.Engine;
        const Render = Matter.Render;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const Events = Matter.Events;
        
        this.engine = Engine.create();
        this.world = this.engine.world;
        
        // 物理エンジンの設定を最適化（落下確実性優先）
        this.engine.world.gravity.y = 1.0; // 重力を強化
        this.engine.constraintIterations = 4; // 制約の反復を増加
        this.engine.positionIterations = 8;   // 位置の反復を増加
        this.engine.velocityIterations = 6;   // 速度の反復を増加
        this.engine.enableSleeping = false;   // スリープを無効化して物理計算を確実に
        
        // 壁の位置を調整（犬が止まらないように）
        const walls = [
            Bodies.rectangle(200, 610, 400, 20, { 
                isStatic: true,
                friction: 0.5,
                restitution: 0.3
            }),
            Bodies.rectangle(-10, 300, 20, 600, { 
                isStatic: true,
                friction: 0.3,
                restitution: 0.2
            }),
            Bodies.rectangle(410, 300, 20, 600, { 
                isStatic: true,
                friction: 0.3,
                restitution: 0.2
            })
        ];
        
        World.add(this.world, walls);
        
        this.dropLine = 50;
        this.currentDog = null;
        this.dogs = [];
        
        // コリジョンフィルターで不要な計算を削減
        Events.on(this.engine, 'collisionStart', (event) => {
            // コリジョンペアをフィルタリングして無駄な処理を減らす
            const validPairs = event.pairs.filter(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                const dogA = this.dogs.find(d => d.body === bodyA);
                const dogB = this.dogs.find(d => d.body === bodyB);
                return dogA && dogB && dogA.type === dogB.type && dogA.type < 11;
            });
            
            if (validPairs.length > 0) {
                this.handleCollisions(validPairs);
            }
        });
        
        this.runner = Matter.Runner.create();
        // タイミング最適化
        this.runner.delta = 1000 / 60; // 60FPS固定
        Matter.Runner.run(this.runner, this.engine);
        
        console.log('Physics engine setup complete - gravity:', this.engine.world.gravity.y, 'sleeping:', this.engine.enableSleeping);
    }
    
    setupEvents() {
        // マウスイベント
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.gameRunning) return;
            
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.max(30, Math.min(370, e.clientX - rect.left));
            
            if (this.currentDog) {
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: this.dropLine });
            }
        });
        
        // タッチイベント
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.gameRunning) return;
            e.preventDefault(); // スクロール防止
            
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.mouseX = Math.max(30, Math.min(370, touch.clientX - rect.left));
            
            if (this.currentDog) {
                Matter.Body.setPosition(this.currentDog.body, { x: this.mouseX, y: this.dropLine });
            }
        }, { passive: false });
        
        this.canvas.addEventListener('click', () => {
            this.dropDogWithFeedback();
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.dropDogWithFeedback();
        }, { passive: false });
        
        document.getElementById('dropButton').addEventListener('click', () => {
            this.dropDogWithFeedback();
        });
        
        document.getElementById('restartButton').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Restart button clicked');
            this.restart();
        });
        
        document.getElementById('playAgainButton').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Play again button clicked');
            this.restart();
        });
        
        this.createNextDog(this.mouseX);
    }
    
    // 触覚フィードバック
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // フィードバック付きドロップ
    dropDogWithFeedback() {
        this.vibrate(50); // 50ms振動
        this.dropDog();
    }
    
    createNextDog(x = 200) {
        if (this.currentDog) {
            console.log('Current dog already exists, removing old one');
            if (this.currentDog.body && this.world) {
                Matter.World.remove(this.world, this.currentDog.body);
            }
        }
        
        const dogConfig = this.dogTypes.find(d => d.type === this.nextDogType);
        if (!dogConfig) {
            console.log('Dog config not found for type:', this.nextDogType);
            return;
        }
        
        console.log(`Creating dog type ${this.nextDogType} at x: ${x}`);
        
        // 大きい犬ほど重く、摩擦が大きくなるように調整
        const sizeRatio = dogConfig.width / 20; // 最小サイズ（20px）との比率
        const body = Matter.Bodies.rectangle(x, this.dropLine, dogConfig.width, dogConfig.height, {
            isStatic: true, // 初期は静的状態
            restitution: 0.4, // 反発係数を統一
            friction: 0.6,    // 摩擦係数を統一
            frictionAir: 0.01, // 空気摩擦を減らして必ず落下させる
            density: 0.001 + sizeRatio * 0.0005, // 密度を適切に設定
            chamfer: { radius: dogConfig.width * 0.25 },
            // 落下を確実にするための追加設定
            sleepThreshold: Infinity, // スリープしない
            inertia: Infinity // 慣性を防ぐ
        });
        
        const dog = {
            body: body,
            type: this.nextDogType,
            width: dogConfig.width,
            height: dogConfig.height,
            image: dogConfig.image,
            score: dogConfig.score
        };
        
        Matter.World.add(this.world, body);
        this.currentDog = dog;
        console.log('Created new dog:', dog.type, 'at position:', body.position, 'isStatic:', body.isStatic);
        
        this.nextDogType = Math.min(5, Math.floor(Math.random() * 3) + 1);
        this.updateNextPreview();
    }
    
    dropDog() {
        console.log('dropDog called with state:', {
            currentDog: !!this.currentDog,
            gameRunning: this.gameRunning,
            canDrop: this.canDrop,
            currentDogStatic: this.currentDog ? this.currentDog.body.isStatic : 'no dog'
        });
        
        if (!this.currentDog || !this.gameRunning || !this.canDrop) {
            console.log('Cannot drop - conditions not met');
            return;
        }
        
        console.log('Dropping dog at position:', this.currentDog.body.position);
        
        // 連打防止
        this.canDrop = false;
        
        // 物理ボディを動的に変更（落下させる）
        Matter.Body.setStatic(this.currentDog.body, false);
        
        // 落下を確実にするための追加処理
        Matter.Body.setVelocity(this.currentDog.body, { x: 0, y: 0.1 }); // 小さな初速度を与えて落下を開始
        Matter.Body.setAngularVelocity(this.currentDog.body, 0); // 回転をリセット
        
        // スリープを無効化して物理計算を継続
        Matter.Sleeping.set(this.currentDog.body, false);
        
        console.log('Dog set to dynamic with initial velocity, should start falling');
        
        // 落下中の犬として記録（一定時間後に削除）
        const droppedDogId = this.currentDog.body.id;
        this.droppedDogs.add(droppedDogId);
        setTimeout(() => {
            this.droppedDogs.delete(droppedDogId);
        }, 2000); // 2秒間は落下中として扱う
        
        this.dogs.push(this.currentDog);
        this.currentDog = null;
        
        setTimeout(() => {
            if (this.gameRunning) {
                this.createNextDog(this.mouseX);  // 現在のマウス位置で作成
                this.canDrop = true;  // 次の犬を作成したらドロップ可能にする
            }
        }, 800);
        
        setTimeout(() => {
            this.checkGameOver();
        }, 3000);
    }
    
    handleCollisions(pairs) {
        // 重複したマージを防ぐためのセット
        const processedPairs = new Set();
        
        pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // 既に処理されたペアをスキップ
            const pairKey = `${Math.min(bodyA.id, bodyB.id)}-${Math.max(bodyA.id, bodyB.id)}`;
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);
            
            const dogA = this.dogs.find(d => d.body === bodyA);
            const dogB = this.dogs.find(d => d.body === bodyB);
            
            if (dogA && dogB && dogA.type === dogB.type && dogA.type < 11) {
                // マージ処理を次のフレームに遅延してパフォーマンス向上
                requestAnimationFrame(() => {
                    if (this.dogs.includes(dogA) && this.dogs.includes(dogB)) {
                        this.mergeDogs(dogA, dogB);
                    }
                });
            }
        });
    }
    
    mergeDogs(dogA, dogB) {
        const newType = dogA.type + 1;
        const newConfig = this.dogTypes.find(d => d.type === newType);
        if (!newConfig) return;
        
        const centerX = (dogA.body.position.x + dogB.body.position.x) / 2;
        const centerY = Math.min(dogA.body.position.y, dogB.body.position.y);
        
        Matter.World.remove(this.world, [dogA.body, dogB.body]);
        
        this.dogs = this.dogs.filter(d => d !== dogA && d !== dogB);
        
        // 合体後の犬も同様にサイズ比率に応じた物理特性
        const newSizeRatio = newConfig.width / 20;
        const newBody = Matter.Bodies.rectangle(centerX, centerY, newConfig.width, newConfig.height, {
            restitution: Math.max(0.3, 0.5 - newSizeRatio * 0.02),
            friction: Math.min(0.8, 0.4 + newSizeRatio * 0.03),
            frictionAir: 0.005 + newSizeRatio * 0.002,
            density: 0.0008 + newSizeRatio * 0.0002,
            chamfer: { radius: newConfig.width * 0.25 }
        });
        
        const newDog = {
            body: newBody,
            type: newType,
            width: newConfig.width,
            height: newConfig.height,
            image: newConfig.image,
            score: newConfig.score
        };
        
        // 合体で生成された犬も一時的に落下中として扱う
        this.droppedDogs.add(newBody.id);
        setTimeout(() => {
            this.droppedDogs.delete(newBody.id);
        }, 1500);
        
        Matter.World.add(this.world, newBody);
        this.dogs.push(newDog);
        
        this.score += newConfig.score * 10;
        this.updateScore();
        
        // 合体の触覚フィードバック
        this.vibrate([100, 50, 100]);
        
        if (newType === 11) {
            this.score += 1000;
            this.updateScore();
            // 最終合体の特別な触覚フィードバック
            this.vibrate([200, 100, 200, 100, 200]);
        }
    }
    
    checkGameOver() {
        if (!this.gameRunning) return;
        
        // パフォーマンス最適化: 間引き処理であまり頻繁にチェックしない
        if (this.lastGameOverCheck && performance.now() - this.lastGameOverCheck < 500) {
            return; // 500ms間隔でチェック
        }
        this.lastGameOverCheck = performance.now();
        
        const safetyMargin = 30;
        
        // 落下中ではない犬をチェック（スリープ無効化で速度で判定）
        const stationaryDogs = this.dogs.filter(dog => {
            if (this.droppedDogs.has(dog.body.id)) return false;
            
            // 速度で静止状態を判定（スリープ機能の代わり）
            const velocity = Matter.Vector.magnitude(dog.body.velocity);
            const angularVelocity = Math.abs(dog.body.angularVelocity);
            return velocity < 0.5 && angularVelocity < 0.1;
        });
        
        for (let dog of stationaryDogs) {
            if (dog.body.position.y < this.dropLine + safetyMargin) {
                console.log('Game over - dog at position:', dog.body.position.y, 'velocity:', Matter.Vector.magnitude(dog.body.velocity));
                this.gameOver();
                return;
            }
        }
    }
    
    gameOver() {
        console.log('Game over triggered');
        this.gameRunning = false;
        
        // ゲームオーバーの触覚フィードバック
        this.vibrate([300, 200, 300]);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    restart() {
        console.log('Restarting game...');
        
        // ゲーム状態をリセット
        this.gameRunning = false;
        this.score = 0;
        this.updateScore();
        document.getElementById('gameOver').style.display = 'none';
        
        // メモリリーク防止: イベントリスナーをクリア
        if (this.engine && this.engine.events) {
            Matter.Events.off(this.engine, 'collisionStart');
        }
        
        // 物理エンジンを停止・クリア
        if (this.runner) {
            Matter.Runner.stop(this.runner);
        }
        
        // 全てのボディを正しく削除
        const allBodies = [...this.dogs.map(d => d.body)];
        if (this.currentDog) {
            allBodies.push(this.currentDog.body);
        }
        
        allBodies.forEach(body => {
            if (body && this.world) {
                Matter.World.remove(this.world, body, true); // 強制削除
            }
        });
        
        // メモリリーク防止: 参照をクリア
        this.dogs.length = 0; // 配列をクリアしつつメモリを解放
        this.currentDog = null;
        this.droppedDogs.clear();
        
        // キャッシュをクリア
        this.cachedColors = null;
        this.responsiveCache = null;
        this.redLineDrawn = false;
        this.lastFrameTime = null;
        this.lastGameOverCheck = null;
        
        Matter.World.clear(this.world, true);
        Matter.Engine.clear(this.engine);
        
        // 物理エンジンを再初期化
        this.setupPhysics();
        
        // ゲーム再開
        this.gameRunning = true;
        this.canDrop = true;
        
        // 少し遅らせて犬を作成（物理エンジンの初期化を待つ）
        setTimeout(() => {
            this.createNextDog(this.mouseX);
        }, 100);
        
        // ゲームループを再開
        if (!this.gameLoopRunning) {
            this.gameLoop();
        }
        
        console.log('Game restarted successfully');
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
    }
    
    updateNextPreview() {
        const nextConfig = this.dogTypes.find(d => d.type === this.nextDogType);
        const nextImageEl = document.getElementById('nextImage');
        
        console.log(`Updating next preview for type: ${this.nextDogType}`);
        console.log(`Next config image exists: ${nextConfig && nextConfig.image ? 'yes' : 'no'}`);
        
        if (nextConfig && nextConfig.image) {
            nextImageEl.src = nextConfig.image.src;
            nextImageEl.style.display = 'block';
            console.log('Next preview updated with actual image');
        } else {
            // メモリ最適化: canvasをキャッシュして再利用
            if (!this.previewCanvas) {
                this.previewCanvas = document.createElement('canvas');
                this.previewCanvas.width = 50;
                this.previewCanvas.height = 50;
                this.previewCtx = this.previewCanvas.getContext('2d');
            }
            
            const ctx = this.previewCtx;
            ctx.clearRect(0, 0, 50, 50);
            
            if (!this.cachedColors) {
                this.cachedColors = [
                    '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                    '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                    '#d4ffba', '#baffdf', '#bac9ff'
                ];
            }
            
            const scaleW = 40 / nextConfig.width;
            const scaleH = 40 / nextConfig.height;
            const scale = Math.min(scaleW, scaleH);
            const displayW = nextConfig.width * scale;
            const displayH = nextConfig.height * scale;
            
            ctx.fillStyle = this.cachedColors[this.nextDogType - 1] || '#ffb3ba';
            ctx.beginPath();
            ctx.ellipse(25, 25, displayW / 2, displayH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.nextDogType.toString(), 25, 25);
            
            nextImageEl.src = this.previewCanvas.toDataURL();
            nextImageEl.style.display = 'block';
            console.log('Next preview updated with placeholder');
        }
    }
    
    gameLoop() {
        this.gameLoopRunning = true;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 赤いラインを毎フレーム描画（視認性向上）
        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.dropLine + 30);
        this.ctx.lineTo(this.canvas.width, this.dropLine + 30);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 犬の描画
        this.dogs.forEach(dog => {
            this.drawDog(dog);
        });
        
        if (this.currentDog) {
            this.drawDog(this.currentDog);
        }
        
        if (this.gameRunning) {
            requestAnimationFrame(() => this.gameLoop());
        } else {
            this.gameLoopRunning = false;
        }
    }
    
    drawDog(dog) {
        const pos = dog.body.position;
        const width = dog.width;
        const height = dog.height;
        const angle = dog.body.angle;
        
        // 回転が小さい場合はスキップ（パフォーマンス向上）
        const shouldRotate = Math.abs(angle) > 0.01;
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        if (shouldRotate) {
            this.ctx.rotate(angle);
        }
        
        if (dog.image) {
            // イメージスムージングを制御（必要な場合のみ有効）
            if (width > dog.image.width || height > dog.image.height) {
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.imageSmoothingQuality = 'medium';
            } else {
                this.ctx.imageSmoothingEnabled = false;
            }
            
            this.ctx.drawImage(
                dog.image,
                -width / 2,
                -height / 2,
                width,
                height
            );
        } else {
            // 画像がない場合のプレースホルダー（キャッシュされた色配列使用）
            if (!this.cachedColors) {
                this.cachedColors = [
                    '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                    '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                    '#d4ffba', '#baffdf', '#bac9ff'
                ];
            }
            
            this.ctx.fillStyle = this.cachedColors[dog.type - 1] || '#ffb3ba';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            if (shouldRotate) {
                this.ctx.rotate(-angle);
            }
            this.ctx.fillStyle = '#333';
            this.ctx.font = `${Math.min(width, height) / 3}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(dog.type.toString(), 0, 0);
        }
        
        this.ctx.restore();
    }
    
    createGrowthCircle() {
        const container = document.getElementById('growthCircle');
        container.innerHTML = ''; // 強制クリアして再生成
        
        console.log('Creating growth circle...');
        
        // キャッシュされた色配列を作成して再利用
        if (!this.cachedColors) {
            this.cachedColors = [
                '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9',
                '#bae1ff', '#c9baff', '#ffbac9', '#ffd4ba',
                '#d4ffba', '#baffdf', '#bac9ff'
            ];
        }
        
        // レスポンシブ計算をキャッシュ
        if (!this.responsiveCache) {
            const isMobile = window.innerWidth <= 800;
            this.responsiveCache = {
                baseRadius: isMobile ? 80 : 150,
                centerX: isMobile ? 100 : 180,
                centerY: isMobile ? 100 : 180,
                scale: isMobile ? 0.25 : 0.3
            };
        }
        
        const { baseRadius, centerX, centerY, scale } = this.responsiveCache;
        
        // DocumentFragmentでDOM操作を最適化
        const fragment = document.createDocumentFragment();
        
        this.dogTypes.forEach((dogType, index) => {
            console.log(`Creating growth item for type: ${dogType.type}, image exists: ${dogType.image ? 'yes' : 'no'}`);
            
            const angle = (index / this.dogTypes.length) * 2 * Math.PI - Math.PI / 2;
            
            const itemWidth = dogType.width * scale;
            const itemHeight = dogType.height * scale;
            const maxSize = Math.max(itemWidth, itemHeight);
            
            const radiusOffset = Math.max(0, (maxSize - 20) * 0.3);
            const currentRadius = baseRadius + radiusOffset;
            
            const x = centerX + currentRadius * Math.cos(angle) - itemWidth / 2;
            const y = centerY + currentRadius * Math.sin(angle) - itemHeight / 2;
            
            const item = document.createElement('div');
            item.className = 'growth-item';
            item.style.cssText = `left: ${x}px; top: ${y}px; width: ${itemWidth}px; height: ${itemHeight}px;`;
            
            const img = document.createElement('img');
            img.alt = `okome${dogType.type}`;
            img.style.cssText = `width: ${itemWidth}px; height: ${itemHeight}px;`;
            
            const placeholder = document.createElement('div');
            placeholder.className = 'growth-placeholder';
            placeholder.style.cssText = `background: ${this.cachedColors[index]}; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #333; font-weight: bold; width: ${itemWidth}px; height: ${itemHeight}px; font-size: ${Math.max(8, itemWidth / 4)}px;`;
            placeholder.textContent = dogType.type;
            
            const tooltip = document.createElement('div');
            tooltip.className = 'growth-tooltip';
            tooltip.textContent = `Lv.${dogType.type} (${dogType.width}×${dogType.height})`;
            
            // 画像が既に読み込み済みの場合
            if (dogType.image) {
                img.src = dogType.image.src;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                console.log(`Using loaded image for type ${dogType.type}`);
            } else {
                // 画像がない場合はプレースホルダーを表示
                img.style.display = 'none';
                img.src = `image/okome${dogType.type}.png`;
                console.log(`Using placeholder for type ${dogType.type}`);
                
                // 画像読み込み成功時の処理
                img.onload = () => {
                    console.log(`Growth circle image loaded for type ${dogType.type}`);
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                
                img.onerror = () => {
                    console.error(`Growth circle image failed to load for type ${dogType.type}`);
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                };
            }
            
            item.appendChild(img);
            item.appendChild(placeholder);
            item.appendChild(tooltip);
            fragment.appendChild(item);
        });
        
        container.appendChild(fragment);
        console.log('Growth circle created');
    }
}

window.addEventListener('load', () => {
    new OkomeGame();
});