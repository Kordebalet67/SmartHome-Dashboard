from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os


class Get_Balance:
    def __init__(self, phone_number: str, password: str) -> None:
        self.firefox_options = Options()
        self.driver=webdriver.Firefox(options=self.firefox_options)
        self.phone_number = phone_number
        self.password = password

    def get_balance(self) -> float:
        return -666.666


class Get_Balance_MTS(Get_Balance):
    def __init__(self, phone_number: str, password: str) -> None:
        super().__init__(phone_number, password)   

    def get_balance(self) -> float:
        def __get_balance_info() -> str:
            self.driver.get("https://ihelper.mts.by/SelfCarePda/Home.mvc")
            
            # XPATH поля ввода номера телефона страницы авторизации 
            # //*[@id="username"]
            wait = WebDriverWait(self.driver, 2)
            input_number = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="username"]')))
            input_number.clear()
            input_number.send_keys(self.phone_number)
    
            # XPATH поля ввода пароля страницы авторизации
            # /html/body/div[2]/form/table/tbody/tr[5]/td[2]/input
            input_pass = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/div[2]/form/table/tbody/tr[5]/td[2]/input')))
            input_pass.clear()
            input_pass.send_keys(self.password)
    
            # Нажатие кнопки входа на странице авторизации
            # /html/body/div[2]/form/table/tbody/tr[6]/td[2]/input
            enter_btn = self.driver.find_element(By.XPATH, '/html/body/div[2]/form/table/tbody/tr[6]/td[2]/input')
            enter_btn.click()
    
            # Получение абзаца текста с балансом счёта
            # /html/body/div[2]/p
            balans_info = self.driver.find_element(By.XPATH, '/html/body/div[2]/p').text
            self.driver.close()
            return balans_info

        balans_info_text = __get_balance_info()

        # 1. Разделяем текст по слову "Баланс:" и берем вторую часть
        if "Баланс:" in balans_info_text:
            balance_part = balans_info_text.split("Баланс:")[1]  # Получаем: " хх,хххх руб."
            
            # 2. Убираем лишние пробелы и слово "руб."
            # split()[0] возьмет первое слово после пробела, то есть "хх,хххх"
            balance_str = balance_part.strip().split()[0] 
            
            # 3. Преобразуем в число (заменяем запятую на точку для Python)
            balance_float = float(balance_str.replace(',', '.'))
            
            # print(f"Извлеченная строка: '{balance_str}'")
            # print(f"Число для расчетов: {balance_float}")
            return balance_float
        else:
            return -666.666


class Get_Balance_A1(Get_Balance):
    def __init__(self, phone_number: str, password: str, type: str = 'Telephone') -> None:
            super().__init__(phone_number, password)
            self.type = type  

    def get_balance(self) -> float:
        def __get_balance_info() -> str:
            self.driver.get("https://myaccount.a1.by/login")

            wait = WebDriverWait(self.driver, 2)
            if self.type == 'Telephone':
                # Переключение на вкладку "Пароль" способа авторизации
                # /html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[2]/div/button[2]
                tab_btn = self.driver.find_element(By.XPATH, '/html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[2]/div/button[2]')
            else:
                # Переключение на вкладку "Лицевой счет" способа авторизации
                # /html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[2]/div/button[3]
                tab_btn = self.driver.find_element(By.XPATH, '/html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/div[3]/div/div[1]/div[2]/div/button[3]')
            tab_btn.click()

            # XPATH поля ввода номера телефона страницы авторизации 
            # //*[@id="password-auth-login-input"]
            input_number = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="password-auth-login-input"]')))
            input_number.clear()
            input_number.send_keys(self.phone_number)

            # XPATH поля ввода пароля страницы авторизации
            # //*[@id="password_login"]
            input_pass = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="password_login"]')))
            input_pass.clear()
            input_pass.send_keys(self.password)
    
            # Нажатие кнопки входа на странице авторизации
            # /html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/form/div/div[3]/button
            enter_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/div/div/div/div[3]/div[2]/div/div/div[1]/div[1]/div/form/div/div[3]/button')))
            enter_btn.click()

            # Нажатие кнопки выбора типа пользователя
            # /html/body/div[1]/div[2]/div/div/div/div[2]/div/div/div[1]/div/div[1]/div[1]/h6
            user_type_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/div[1]/div[2]/div/div/div/div[2]/div/div/div[1]/div/div[1]/div[1]/h6')))
            user_type_btn.click()

            # Получение абзаца текста с балансом счёта
            # /html/body/div[1]/div/header/div/div[3]/div/div
            balans_info = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/div[1]/div/header/div/div[3]/div/div')))
            balans_info = self.driver.find_element(By.XPATH, '/html/body/div[1]/div/header/div/div[3]/div/div').text


            self.driver.close()
            
            return balans_info
        balans_info_text = __get_balance_info()
        balans_info_text = balans_info_text.split('\n')
        balance_float = float(balans_info_text[0].replace(',', '.'))
        return balance_float


class Get_Balance_Beltelecom(Get_Balance):
    pass 


# Распознавание капчи онлайн
# https://www.prepostseo.com/ru/image-to-text
# надо сохранять капчу как картинку и потом загружать на сайт. считывать из поля ответа только первую строку
def recognize_capcha(driver: webdriver.Firefox) -> int:
    # Находим капчу: //*[@id="capcher"]
    element = driver.find_element(By.XPATH, '//*[@id="capcher"]')
    # Сохраняем скриншот только этого элемента
    element.screenshot('capcha_temp/capcha.png')
    # Хорошо бы сделать яркость +25 и экспозицию -45, так точнее будет определяться



    driver.get('https://www.prepostseo.com/ru/image-to-text')
    # Находим скрытый input для загрузки файлов
    file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
    # Если input скрыт, делаем его видимым через JavaScript
    driver.execute_script("arguments[0].style.display = 'block';", file_input)
    driver.execute_script("arguments[0].style.visibility = 'visible';", file_input)

    # Указываем абсолютный путь к файлу
    file_path = os.path.abspath("capcha_temp/capcha.png")

    # Отправляем файл в input
    file_input.send_keys(file_path)

    # Жмем кнопку преобразовать
    # /html/body/main/section[1]/div[4]/div[3]/div[1]
    wait = WebDriverWait(driver, 2)
    convert_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/main/section[1]/div[4]/div[3]/div[1]')))
    convert_btn.click()

    # Забираем результат
    # //*[@id="result__text0"]
    wait = WebDriverWait(driver, 20)
    capcha_text = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="result__text0"]')))
    capcha_text = driver.find_element(By.XPATH, '//*[@id="result__text0"]').text
    capcha_text = capcha_text.split('\n')
    print(capcha_text)
    
    for item in capcha_text:
            print(item)
            print(len(item))
            if ' ' in item:
                item_list = item.split()
                for iter in item_list:
                    if len(iter) == 4:
                        capcha = int(iter)
                        print(capcha)
                    
            elif len(item) == 4:
                capcha = int(item)
                print(capcha)
            else:
                capcha = int(item[:4])
                print(capcha)




    return 0


if __name__ == '__main__':
    #mts_balance = Get_Balance_A1("", "")
    #print(mts_balance.get_balance())
    firefox_options = Options()
    driver=webdriver.Firefox(options=firefox_options)
    driver.get('https://issaold.beltelecom.by/main.html')
    recognize_capcha(driver)
    