#!/usr/bin/env python3
"""
Script para remover todos os console.log de debug do código.
Remove logs com prefixos emoji e logs com tags [Component].
"""

import re
import sys
from pathlib import Path

def remove_console_logs(content: str) -> tuple[str, int]:
    """
    Remove console.log statements do conteúdo.
    Retorna o conteúdo limpo e o número de linhas removidas.
    """
    lines = content.split('\n')
    cleaned_lines = []
    removed_count = 0
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()

        # Padrões de console.log a serem removidos
        patterns = [
            # Logs com emoji no início
            r'^console\.log\([\'"][\U0001F300-\U0001FAFF]',
            # Logs com tags [ComponentName]
            r'^console\.log\([\'\"]\[[\w\s]+\]',
            # Logs genéricos
            r'^console\.log\(',
        ]

        should_remove = False
        for pattern in patterns:
            if re.search(pattern, stripped):
                should_remove = True
                break

        if should_remove:
            # Verifica se é uma linha simples ou multilinha
            if stripped.count('(') == stripped.count(')'):
                # Console.log em linha única
                removed_count += 1
                i += 1
                continue
            else:
                # Console.log multilinha - procura o fechamento
                paren_count = stripped.count('(') - stripped.count(')')
                removed_count += 1
                i += 1

                while i < len(lines) and paren_count > 0:
                    line = lines[i]
                    paren_count += line.count('(') - line.count(')')
                    removed_count += 1
                    i += 1
                continue

        cleaned_lines.append(line)
        i += 1

    return '\n'.join(cleaned_lines), removed_count

def process_file(file_path: Path) -> bool:
    """
    Processa um arquivo removendo console.log.
    Retorna True se modificações foram feitas.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        cleaned_content, removed_count = remove_console_logs(original_content)

        if removed_count > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)
            print(f"✅ {file_path}: {removed_count} linhas de log removidas")
            return True
        else:
            print(f"⏭️  {file_path}: Nenhum log encontrado")
            return False

    except Exception as e:
        print(f"❌ Erro ao processar {file_path}: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 remove-all-logs.py <arquivo1> [arquivo2] ...")
        print("   ou: python3 remove-all-logs.py --all (processa todos os arquivos do projeto)")
        sys.exit(1)

    if sys.argv[1] == '--all':
        # Processa todos os arquivos relevantes do projeto
        base_path = Path('/root/pagina-cota.i/src')
        patterns = ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js']

        files_to_process = []
        for pattern in patterns:
            files_to_process.extend(base_path.glob(pattern))

        # Remove arquivos node_modules e outros
        files_to_process = [
            f for f in files_to_process
            if 'node_modules' not in str(f) and '.next' not in str(f)
        ]

        print(f"🔍 Encontrados {len(files_to_process)} arquivos para processar\n")

        modified_count = 0
        for file_path in files_to_process:
            if process_file(file_path):
                modified_count += 1

        print(f"\n✅ Concluído! {modified_count} arquivos modificados")
    else:
        # Processa arquivos específicos
        modified_count = 0
        for file_arg in sys.argv[1:]:
            file_path = Path(file_arg)
            if file_path.exists():
                if process_file(file_path):
                    modified_count += 1
            else:
                print(f"❌ Arquivo não encontrado: {file_path}")

        print(f"\n✅ Concluído! {modified_count} arquivos modificados")

if __name__ == '__main__':
    main()
