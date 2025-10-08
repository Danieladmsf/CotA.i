// 🧪 TESTE COMPLETO DO GEMINI CODE ASSIST
// Use este arquivo para verificar se tudo está funcionando

console.log("Testando Gemini Code Assist...");

// 1. TESTE BÁSICO - Digite aqui e veja se aparece sugestão automática:
function calculateFibonacci

// 2. TESTE DE CHAT INLINE - Selecione a linha acima e pressione Ctrl+I
// Depois digite: "/generate complete this fibonacci function"

// 3. TESTE DE EXPLICAÇÃO - Selecione o código abaixo e pressione Ctrl+I
// Depois digite: "/explain what this function does"
function quickSort(arr) {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const equal = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...quickSort(left), ...equal, ...quickSort(right)];
}

// 4. TESTE DE CORREÇÃO - Este código tem erro, selecione e use "/fix"
function brokenFunction() {
    console.log("Hello World"
    return undefined
}

// 5. TESTE DE MELHORIAS - Selecione abaixo e peça otimização
function inefficientLoop(numbers) {
    let result = [];
    for (let i = 0; i < numbers.length; i++) {
        for (let j = 0; j < numbers.length; j++) {
            if (i !== j && numbers[i] === numbers[j]) {
                result.push(numbers[i]);
            }
        }
    }
    return result;
}

// 🎯 COMANDOS PARA TESTAR:
// Ctrl+Shift+P → "Gemini: Open Chat"     # Chat na sidebar
// Ctrl+I                                 # Chat inline
// Ctrl+Enter                             # Gerar código a partir de comentário
// Botão direito → Smart Actions          # Menu contextual com IA

// ✨ DICA: Procure o ícone do Gemini na barra lateral esquerda!