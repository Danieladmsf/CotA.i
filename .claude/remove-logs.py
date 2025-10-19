#!/usr/bin/env python3
"""
Remove console.log statements while preserving console.error and console.warn
"""
import re
import sys

def remove_console_logs(content):
    """Remove console.log but keep console.error and console.warn"""
    lines = content.split('\n')
    result_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a console.log statement
        if re.search(r'console\.log\s*\(', line):
            # Count opening and closing parens to find the full statement
            paren_count = line.count('(') - line.count(')')

            # If statement is complete on one line, skip it
            if paren_count == 0:
                i += 1
                continue

            # Multi-line console.log - skip until we find the closing paren
            while i < len(lines) - 1 and paren_count > 0:
                i += 1
                paren_count += lines[i].count('(') - lines[i].count(')')

            i += 1
            continue

        # Keep all other lines (including console.error and console.warn)
        result_lines.append(line)
        i += 1

    return '\n'.join(result_lines)

def clean_empty_lines(content):
    """Remove excessive empty lines (more than 2 consecutive)"""
    return re.sub(r'\n\n\n+', '\n\n', content)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python remove-logs.py <file>")
        sys.exit(1)

    filepath = sys.argv[1]

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove console.log statements
    content = remove_console_logs(content)

    # Clean up excessive empty lines
    content = clean_empty_lines(content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Removed console.log from {filepath}")
