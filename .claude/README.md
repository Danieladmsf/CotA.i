# 🎲 Claude Auto - Randomização Automática de Portas

Sistema **ultra simples** que inicia o Claude CLI com **randomização automática** de portas a cada minuto.

---

## ⚡ Quick Start

```bash
claude-auto
```

**Pronto!** 🎉

O Claude vai:
1. ✅ Sortear uma porta aleatória inicial
2. ✅ Abrir o CLI interativo
3. ✅ **Trocar automaticamente para outra porta a cada 60 segundos**

---

## 🎯 Como Funciona

```
$ claude-auto

╔════════════════════════════════════════════════════════════╗
║  🎲 Claude Auto - Randomização Ativa                       ║
╚════════════════════════════════════════════════════════════╝

  🔌 Porta Inicial: 62610
  🔄 Auto-Switch: A cada 60 segundos
  📋 Sessões: 3 portas disponíveis (62609, 62610, 62611)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Claude CLI Interativo já funcionando!]
> _
```

---

## 🔄 Randomização Automática

### **O que acontece em background:**

```
Tempo    Porta      Sessão
─────────────────────────────
00:00 → 62610  →  Sessão #2
01:00 → 62611  →  Sessão #3  ← Trocou automaticamente!
02:00 → 62609  →  Sessão #1  ← Trocou de novo!
03:00 → 62610  →  Sessão #2  ← Continua trocando...
```

**Você não precisa fazer NADA!**
- ✅ Use o Claude normalmente
- ✅ A porta troca sozinha em background
- ✅ Distribuição automática entre 3 portas

---

## 📊 Verificar Randomização

### **Método 1: Ver o log de trocas**

```bash
# Em outro terminal
tail -f ~/.claude/tmux-sessions/auto_switch.log
```

**Saída:**
```
22:40:00 - Auto-switch para porta 62610
22:41:00 - Auto-switch para porta 62611
22:42:00 - Auto-switch para porta 62609
22:43:00 - Auto-switch para porta 62610
```

### **Método 2: Verificar porta atual**

```bash
echo $CLAUDE_CODE_SSE_PORT
```

---

## ⚙️ Configuração

### **Mudar intervalo de troca:**

```bash
# Editar o script
nano /root/pagina-cota.i/.claude/claude-auto

# Linha 15, alterar:
SWITCH_INTERVAL=60  # Mudar para 30, 120, 300, etc.
```

### **Portas utilizadas:**

O sistema usa 3 portas por padrão:
- **62609** (Porta base + 1)
- **62610** (Porta base + 2)
- **62611** (Porta base + 3)

Para alterar a porta base, edite:
```bash
BASE_PORT=62608  # Mudar para outra base
```

---

## 🏗️ Arquitetura

### **Estrutura:**

```
~/.claude/tmux-sessions/
├── sessions.json              # Configuração das 3 sessões
├── auto_switch.log           # Log de trocas automáticas
└── .auto_switcher.pid        # PID do processo de auto-switch
```

### **sessions.json:**

```json
[
  {"id": 1, "port": 62609, "tmux_session": "claude-1"},
  {"id": 2, "port": 62610, "tmux_session": "claude-2"},
  {"id": 3, "port": 62611, "tmux_session": "claude-3"}
]
```

### **Como funciona internamente:**

```
┌──────────────────────────────────────┐
│  Script Principal (claude-auto)      │
│  - Inicia Claude CLI                 │
│  - Sorteia porta inicial             │
└──────────────────────────────────────┘
            │
            ├─── Fork ───┐
            │             │
            ▼             ▼
    ┌──────────────┐  ┌────────────────────┐
    │ Claude CLI   │  │ Auto-Switcher      │
    │ Interativo   │  │ (Background)       │
    │              │  │                    │
    │ Usa porta    │  │ A cada 60s:        │
    │ atual        │  │ 1. Sorteia nova    │
    │              │  │ 2. Exporta porta   │
    │              │  │ 3. Loga troca      │
    └──────────────┘  └────────────────────┘
```

---

## 📋 Casos de Uso

### **1. Desenvolvimento com Balanceamento**

```bash
# Simplesmente use:
claude-auto

# O sistema distribui automaticamente entre 3 portas
# Balanceamento de carga automático
```

### **2. Testes de Múltiplas Sessões**

```bash
# Abra 3 terminais
Terminal 1: claude-auto  # Pode cair na porta 62609
Terminal 2: claude-auto  # Pode cair na porta 62610
Terminal 3: claude-auto  # Pode cair na porta 62611

# Cada um troca automaticamente
```

### **3. Evitar Sobrecarga**

O auto-switch distribui o uso entre múltiplas portas/sessões, evitando que uma única porta seja sobrecarregada.

---

## 🔧 Troubleshooting

### **Problema: Porta não está trocando**

**Verificar:**
```bash
# Ver se o auto-switcher está rodando
ps aux | grep auto_switcher

# Ver o log
tail -f ~/.claude/tmux-sessions/auto_switch.log
```

### **Problema: Claude não inicia**

**Solução:**
```bash
# Criar as sessões manualmente
mkdir -p ~/.claude/tmux-sessions

# Executar novamente
claude-auto
```

### **Problema: Erro "jq não encontrado"**

**Solução:**
```bash
sudo apt-get update && sudo apt-get install -y jq
```

---

## 🚀 Instalação

### **Automática (primeira execução):**

```bash
claude-auto
```

O script cria tudo automaticamente:
- ✅ Diretório de sessões
- ✅ Arquivo de configuração JSON
- ✅ 3 sessões/portas disponíveis

### **Manual (se necessário):**

```bash
# Copiar script
sudo cp /root/pagina-cota.i/.claude/claude-auto /usr/local/bin/

# Dar permissão
sudo chmod +x /usr/local/bin/claude-auto
```

---

## 📚 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `claude-auto` | Inicia Claude com auto-switch |
| `tail -f ~/.claude/tmux-sessions/auto_switch.log` | Ver log de trocas |
| `echo $CLAUDE_CODE_SSE_PORT` | Ver porta atual |
| `ps aux \| grep auto_switcher` | Ver se switcher está rodando |

---

## 🎓 Conceitos

### **O que é Auto-Switch?**

É um processo em background que:
1. Monitora o tempo (a cada 60 segundos)
2. Sorteia uma nova porta aleatoriamente
3. Atualiza a variável `CLAUDE_CODE_SSE_PORT`
4. Loga a troca

### **Por que 3 portas?**

- ✅ Balanceamento simples
- ✅ Distribuição uniforme (~33% cada)
- ✅ Evita conflitos
- ✅ Fácil de gerenciar

### **E se eu quiser mais portas?**

Edite o script `claude-auto` e adicione mais entradas no loop de criação de sessões.

---

## 💡 Filosofia

> **"Zero esforço, máxima automação"**

Este sistema foi projetado para:
- ❌ **NÃO** exigir escolhas
- ❌ **NÃO** exigir configuração manual
- ❌ **NÃO** exigir monitoramento
- ✅ **SIM** funcionar 100% automaticamente
- ✅ **SIM** com um único comando

---

## 📊 Estatísticas de Uso

Após usar por algum tempo, você pode verificar a distribuição:

```bash
# Contar trocas por porta
grep "porta 62609" ~/.claude/tmux-sessions/auto_switch.log | wc -l
grep "porta 62610" ~/.claude/tmux-sessions/auto_switch.log | wc -l
grep "porta 62611" ~/.claude/tmux-sessions/auto_switch.log | wc -l
```

**Distribuição esperada:** ~33% para cada porta (randomização uniforme)

---

## 🎯 Arquivos do Sistema

```
/root/pagina-cota.i/.claude/
├── claude-auto               # Script principal (único necessário!)
└── README.md                 # Esta documentação

~/.claude/tmux-sessions/
├── sessions.json             # Config das 3 sessões
├── auto_switch.log          # Log de trocas
└── .auto_switcher.pid       # PID do switcher

/usr/local/bin/
└── claude-auto              # Link simbólico global
```

---

## ❓ FAQ

### **P: A troca interrompe o Claude?**
R: Não! O Claude continua rodando normalmente. Só a porta de comunicação muda.

### **P: Posso parar o auto-switch?**
R: Sim, pressione `Ctrl+C` para sair do Claude. O auto-switcher para automaticamente.

### **P: Posso usar o Claude normal sem auto-switch?**
R: Sim! Use `claude` normalmente. O `claude-auto` é opcional.

### **P: As 3 sessões são realmente independentes?**
R: Sim! Cada porta representa uma sessão separada com seu próprio contexto.

### **P: Como sei qual porta está ativa?**
R: Execute `echo $CLAUDE_CODE_SSE_PORT` ou veja o log.

---

## 🙏 Desenvolvido com

❤️ **Claude Code** - Anthropic

---

## 📄 Licença

MIT License - Use livremente! 🎉

---

## 🚀 Comece Agora!

```bash
claude-auto
```

**É só isso!** Simples, automático, prático. 🎲✨
