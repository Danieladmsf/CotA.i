# 🧪 TESTE DO GEMINI CODE ASSIST
# Use este arquivo para testar as funcionalidades

# 1. TESTE DE AUTOCOMPLETAR: Digite "def hello" na linha abaixo e pressione Enter
def hello

# 2. TESTE DE CHAT INLINE: Selecione a linha acima e pressione Ctrl+I
# Depois digite: "complete esta função para cumprimentar uma pessoa"

# 3. TESTE DE GERAÇÃO: Pressione Ctrl+I em qualquer lugar e digite:
# "/generate function to calculate fibonacci numbers"

# 4. TESTE DE EXPLICAÇÃO: Selecione o código abaixo e pressione Ctrl+I
# Depois digite: "/explain"

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# 5. TESTE DE CORREÇÃO: O código abaixo tem erro, selecione e use "/fix"
def broken_function()
    print("Este código tem erro de sintaxe"

# 6. TESTE DE MELHORIAS: Selecione o código abaixo e peça melhorias
def inefficient_sum(numbers):
    total = 0
    for i in range(len(numbers)):
        total = total + numbers[i]
    return total

# 🎯 DICAS:
# - Ctrl+Shift+P → "Gemini: Open Chat" para abrir chat sidebar
# - Ctrl+I = Chat inline no cursor
# - Ctrl+Enter = Gerar código baseado em comentário
# - Selecione código + botão direito = Smart Actions