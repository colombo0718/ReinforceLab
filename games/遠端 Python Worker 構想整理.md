    # RR 遠端 Python Worker 構想整理

    ## 一、核心定位

    這個系統不應該被理解成「開一個危險的 API 來執行任意 Python」，
    而應該被理解成：

    > **在固定 Flask 工作區內運作的遠端 Python 執行節點**
    >
    > 也就是 RR 的遠端自動化引擎。

    它的目的，是讓 Claude Code 或其他 agent 可以產生腳本，
    再把腳本丟到遠端 worker 執行，最後回收結果、log、截圖、影片或實驗輸出。

    ---

    ## 二、為什麼這樣設計比較合理

    原本若做成：

    - 任意指定路徑
    - 任意指定檔名
    - 任意傳入 Python 程式碼直接寫檔執行

    本質上就是一個 RCE（Remote Code Execution）入口。

    但如果限縮成：

    - **只能在 Flask 專案底下固定目錄執行**
    - **不允許外部指定任意路徑**
    - **由 server 自己建立 job 資料夾**
    - **由 server 自己管理檔名與輸出**

    那它就從危險的「遠端執行器」，
    變成比較可控的「遠端 worker」。

    ---

    ## 三、這個 worker 對 RR 的用途

    這種 worker 很適合支援 RR 後續的自動化需求，例如：

    ### 1. 巡檢模式
    由 agent 自動撰寫 Playwright Python 腳本，執行例如：

    - 開啟 RR 首頁
    - 切換不同 tab
    - 載入不同遊戲
    - 點擊訓練按鈕
    - 檢查畫面元素是否正常
    - 自動截圖
    - 匯出 log 與結果

    ### 2. 實驗模式
    由 agent 產生批次實驗腳本，例如：

    - 同一個遊戲
    - 不同超參數（epsilon / alpha / gamma）
    - 各跑數次
    - 匯總平均 reward、步數、成功率

    最後輸出：

    - CSV
    - JSON
    - 圖表
    - 報告文字檔

    ### 3. 自動錄教學影片
    腳本可自動：

    - 開啟 RR
    - 切到指定遊戲或頁面
    - 執行示範流程
    - 搭配 ffmpeg 錄製畫面
    - 匯出教學影片

    ### 4. 直播相關控制
    更進一步可用於：

    - 啟動直播瀏覽器環境
    - 長時間維持控制 session
    - 接收 webhook / LINE 命令
    - 切換遊戲、開始訓練、重整畫面、巡檢畫面

    ---

    ## 四、整體工作流程

    這個系統的理想閉環是：

    1. **Claude / agent 負責寫腳本**
    2. **遠端 worker 負責執行腳本**
    3. **worker 回傳 stdout / stderr / artifact**
    4. **Claude / agent 根據結果修正腳本**
    5. **再次送出執行**

    也就是：

    > 寫腳本 → 遠端執行 → 回收結果 → 修正 → 再執行

    這對 RR 的巡檢、自動化實驗、影片錄製、直播控制都非常適合。

    ---

    ## 五、建議的 API 分層

    由於任務有短有長，不應該全部都做成同步阻塞式回傳，
    建議至少分成兩種模式。

    ### A. 短任務模式

    適合：

    - 小段 Python 驗證
    - 小型資料處理
    - 快速測試
    - 立刻拿 stdout/stderr

    建議 API：

    `POST /run_code`

    輸入範例：

        {
          "code": "print('hello')",
          "timeout": 10
        }

    回傳範例：

        {
          "ok": true,
          "return_code": 0,
          "stdout": "hello\n",
          "stderr": ""
        }

    ---

    ### B. 長任務模式

    適合：

    - Playwright 巡檢
    - 批次實驗
    - 自動錄影
    - 長時間訓練
    - 長時間監控

    建議 API：

    #### `POST /jobs`
    建立長任務

        {
          "name": "rr_patrol_check",
          "code": "...playwright python code...",
          "timeout": 1800
        }

    回傳：

        {
          "ok": true,
          "job_id": "20260409_abcd1234",
          "status": "queued"
        }

    #### `GET /jobs/<job_id>`
    查詢任務狀態

        {
          "job_id": "20260409_abcd1234",
          "status": "running",
          "return_code": null,
          "started_at": "...",
          "finished_at": null
        }

    #### `GET /jobs/<job_id>/logs`
    取得 stdout / stderr

    #### `GET /jobs/<job_id>/artifacts`
    取得輸出成果列表，例如：

    - screenshot.png
    - result.json
    - report.txt
    - output.mp4

    ---

    ## 六、建議的目錄結構

    建議所有任務都固定在 Flask 專案底下的 worker 區域執行。

        /flask_app
            /worker_jobs
                /20260409_abcd1234
                    main.py
                    stdout.txt
                    stderr.txt
                    status.json
                    result.json
                    /artifacts
                        shot1.png
                        report.json
                        demo.mp4

    這樣的好處是：

    - 永遠只在固定範圍內執行
    - 不讓外部指定任意路徑
    - 任務互相隔離
    - 輸出物集中好管理
    - 方便之後查 log、查成果、清理舊任務

    ---

    ## 七、直播需求要另外區分

    有些任務是「一次執行完就結束」，
    例如：

    - 巡檢
    - 匯出報表
    - 跑一組實驗
    - 錄一段教學影片

    但直播不是這種型態。

    直播更像是：

    - 啟動一個長駐程式
    - 保持瀏覽器 session 活著
    - 接受外部指令
    - 持續控制 RR

    所以直播比較適合再做成另一類：

    ### `control worker`
    而不是單純的 `/jobs`

    例如可以有：

    - `start_stream_worker`
    - `send_command`
    - `stop_stream_worker`

    送進去的不是整段 Python，
    而是像這種控制命令：

        {
          "command": "load_game",
          "game": "1d_maze"
        }

    或：

        {
          "command": "start_training",
          "agent": "q_learning"
        }

    這會比一直重送整段腳本更穩定。

    ---

    ## 八、至少要有的安全與穩定保護

    即使這個系統主要是自己使用，也建議至少加上這三個基礎保護。

    ### 1. Token 驗證
    每個 API 呼叫都必須帶驗證資訊，例如 Bearer Token。

    ### 2. Timeout
    每個任務都必須有限時，
    避免無限迴圈、卡死、長時間占用資源。

    ### 3. 單機併發限制
    例如同時只允許跑 1～2 個 job，
    避免：

    - 多個 Playwright 互搶瀏覽器資源
    - ffmpeg 與實驗同時打架
    - RR 任務彼此干擾
    - 主機被自己塞爆

    ---

    ## 九、建議的 worker 分類

    長遠來看，可以把 worker 分成兩類。

    ### 1. script worker
    用來跑一次性 Python 腳本。

    適合：

    - 巡檢
    - 實驗
    - 報表
    - 錄影
    - 截圖

    ### 2. control worker
    用來維持長駐 session。

    適合：

    - 直播
    - 遠端操控 RR
    - webhook / LINE 命令轉發
    - 持續觀察與控制瀏覽器

    ---

    ## 十、這套架構的真正意義

    這個系統不只是「可以遠端跑一段 Python」而已。

    它真正的價值是：

    > **把 RR 平台從手動操作，提升成可以被 agent 遠端驅動的自動化系統。**

    也就是：

    - RR 巡檢自動化
    - RR 實驗自動化
    - 教學影片生產自動化
    - 直播控制半自動化
    - Claude Code / agent 的遠端行動能力

    所以應該把它定位成：

    > **RR 的遠端自動化引擎**
    >
    > 而不是單純的「執行 Python API」。

    ---

    ## 十一、建議的開發順序

    最值得先做的最小版本是：

    1. `POST /jobs`
    2. `GET /jobs/<id>`
    3. `GET /jobs/<id>/logs`

    先把：

    - 建 job
    - 寫檔
    - 執行
    - 回收 stdout / stderr
    - 查詢狀態

    這一整套跑通。

    等這版穩了之後，再往下加：

    - artifact 管理
    - Playwright 支援
    - ffmpeg 支援
    - 長駐 control worker
    - webhook / LINE 控制整合

    ---

    ## 十二、總結一句話

    你的方向是對的。

    現在應該把這套東西定義成：

    > **固定 Flask 工作區內的遠端 Python Worker**
    >
    > 並逐步升級成 RR 的遠端自動化引擎。

    這樣它才能真正支援：

    - 巡檢
    - 實驗
    - 錄影
    - 教學展示
    - 直播控制
    - agent 遠端操作 RR