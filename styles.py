STYLES = """
QMainWindow {
    background-color: #0f0f1e;
}

/* Кастомный Title Bar */
#titleBar {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, 
                                stop:0 #1a1a2e, stop:1 #16213e);
    border-bottom: 1px solid #2a2a3e;
}

#windowTitle {
    color: #e0e0ff;
    font-size: 13px;
    font-weight: 500;
    padding-left: 10px;
}

#minimizeBtn, #maximizeBtn, #closeBtn {
    background-color: transparent;
    border: none;
    color: #8888aa;
    font-size: 16px;
    font-weight: bold;
    padding: 0;
}

#minimizeBtn:hover, #maximizeBtn:hover {
    background-color: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
}

#closeBtn:hover {
    background-color: #ef4444;
    color: white;
}

/* Боковая панель */
#sidebar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, 
                                stop:0 #1a1a2e, stop:1 #16213e);
    border-right: 1px solid #2a2a3e;
}

/* Кнопки в сайдбаре */
#sidebarBtn {
    background-color: transparent;
    color: #8888aa;
    border: none;
    border-radius: 10px;
    padding: 14px 20px;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
}
#sidebarBtn:hover {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
}
#sidebarBtn.active {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, 
                                stop:0 #8b5cf6, stop:1 #6366f1);
    color: white;
    font-weight: 600;
}

/* Верхняя панель */
#topBar {
    background-color: transparent;
}

/* Карточки виджетов */
#widgetCard {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, 
                                stop:0 #1e1e2e, stop:1 #252538);
    border-radius: 16px;
    border: 1px solid #2a2a3e;
}
#widgetCard:hover {
    border: 1px solid #8b5cf6;
}

/* Заголовки виджетов */
#widgetTitle {
    color: #e0e0ff;
    font-size: 14px;
    font-weight: 600;
}

/* Кнопки закрытия */
#closeBtn {
    background-color: transparent;
    color: #666680;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: bold;
}
#closeBtn:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
}

/* Основные кнопки */
#primaryBtn {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, 
                                stop:0 #8b5cf6, stop:1 #6366f1);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
}
#primaryBtn:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, 
                                stop:0 #7c3aed, stop:1 #4f46e5);
}

#secondaryBtn {
    background-color: #2a2a3e;
    color: #a0a0c0;
    border: 1px solid #3a3a4e;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 12px;
}
#secondaryBtn:hover {
    background-color: #3a3a4e;
    color: #c0c0e0;
}

/* Текст */
#mainTitle {
    color: #ffffff;
    font-size: 26px;
    font-weight: 700;
}

#subtitle {
    color: #8888aa;
    font-size: 13px;
}

/* Виджеты - специфичные стили */
#balanceAmount {
    color: #10b981;
    font-size: 28px;
    font-weight: 700;
}

#tempValue {
    color: #60a5fa;
    font-size: 32px;
    font-weight: 700;
}

#statusText {
    color: #a0a0c0;
    font-size: 13px;
}

#infoText {
    color: #666680;
    font-size: 11px;
}

/* Диалоги */
QDialog {
    background-color: #1a1a2e;
    border-radius: 12px;
}
QLabel {
    color: #e0e0ff;
}
QComboBox {
    background-color: #2a2a3e;
    color: #e0e0ff;
    border: 1px solid #3a3a4e;
    border-radius: 8px;
    padding: 8px;
    font-size: 13px;
}
QComboBox::drop-down {
    border: none;
    background: transparent;
}
QComboBox QAbstractItemView {
    background-color: #2a2a3e;
    color: #e0e0ff;
    selection-background-color: #8b5cf6;
    border-radius: 8px;
}

/* Скроллбар */
QScrollBar:vertical {
    border: none;
    background: #0f0f1e;
    width: 8px;
    margin: 0;
}
QScrollBar::handle:vertical {
    background: #3a3a4e;
    border-radius: 4px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover {
    background: #8b5cf6;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}
"""