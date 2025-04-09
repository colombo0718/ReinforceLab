from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By  # 確保正確導入 By
from webdriver_manager.chrome import ChromeDriverManager

# 使用 WebDriver Manager 自動管理 ChromeDriver
service = Service(ChromeDriverManager().install())

# 設定 ChromeOptions
options = Options()
options.add_argument('--start-maximized')  # 最大化窗口
options.add_experimental_option("excludeSwitches", ["enable-automation"])  # 移除自動測試訊息
options.add_experimental_option('useAutomationExtension', False)  # 禁用自動化擴展
# 添加參數以解除安全限制
options.add_argument("--disable-web-security")  # 禁用同源策略
options.add_argument("--allow-file-access-from-files")  # 允許 file:// 協議訪問本地檔案
options.add_argument("--allow-running-insecure-content")  # 允許不安全內容
options.add_argument("--disable-site-isolation-trials")  # 禁用站點隔離（有助於跨域）


driver = webdriver.Chrome(service=service, options=options)

# 打開網頁
driver.get("file:///C:/Users/user/ReinforceLab/index.html") 
print(driver.title)

# 定位按鈕並點擊
# button = driver.find_element(By.ID, "game-maze")  # 替換 "me" 為按鈕的實際 ID
# button.click()
# button = driver.find_element(By.ID, "me")  # 替換 "me" 為按鈕的實際 ID
# button.click()

# 等待觀察
input("Press Enter to close the browser...")
driver.quit()