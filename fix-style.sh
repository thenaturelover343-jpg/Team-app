#!/bin/bash
# Remove all indigo/blue from the code and replace with zinc-900 (black) and zinc-100 (light gray)

for file in src/*.tsx; do
  # Buttons
  sed -i 's/bg-indigo-600/bg-zinc-900/g' "$file"
  sed -i 's/bg-indigo-700/bg-zinc-800/g' "$file"
  sed -i 's/hover:bg-indigo-700/hover:bg-zinc-800/g' "$file"
  
  # Text
  sed -i 's/text-indigo-600/text-zinc-900/g' "$file"
  sed -i 's/text-indigo-700/text-zinc-900/g' "$file"
  sed -i 's/text-indigo-800/text-zinc-900/g' "$file"
  
  # Borders
  sed -i 's/border-indigo-100/border-zinc-200/g' "$file"
  sed -i 's/border-indigo-200/border-zinc-300/g' "$file"
  
  # Backgrounds
  sed -i 's/bg-indigo-50/bg-zinc-100/g' "$file"
  sed -i 's/bg-indigo-100/bg-zinc-200/g' "$file"
  
  # Blue
  sed -i 's/bg-blue-600/bg-zinc-900/g' "$file"
  sed -i 's/bg-blue-700/bg-zinc-800/g' "$file"
  sed -i 's/text-blue-500/text-zinc-500/g' "$file"
  sed -i 's/text-blue-600/text-zinc-900/g' "$file"
  sed -i 's/text-blue-700/text-zinc-900/g' "$file"
  sed -i 's/text-blue-800/text-zinc-900/g' "$file"
  sed -i 's/bg-blue-50/bg-zinc-100/g' "$file"
  sed -i 's/bg-blue-100/bg-zinc-200/g' "$file"
  sed -i 's/border-blue-100/border-zinc-200/g' "$file"
  sed -i 's/border-blue-200/border-zinc-300/g' "$file"
  
  # Focus rings
  sed -i 's/focus:ring-blue-500\/20/focus:ring-zinc-900\/10/g' "$file"
  sed -i 's/focus:border-blue-500/focus:border-zinc-900/g' "$file"
  sed -i 's/ring-blue-500/ring-zinc-900/g' "$file"
done

# Fix the admin header button in App.tsx
sed -i 's/bg-zinc-800 hover:bg-zinc-100 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-200/bg-white hover:bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200/g' src/App.tsx
sed -i 's/bg-zinc-800 border-b border-zinc-200 px-4 py-2 flex justify-center/bg-white border-b border-zinc-200 px-4 py-2 flex justify-center/g' src/App.tsx
sed -i 's/text-zinc-500 px-4 py-1.5 rounded-lg border border-zinc-200 w-full/text-zinc-700 bg-zinc-50 hover:bg-zinc-100 px-4 py-1.5 rounded-lg border border-zinc-200 w-full/g' src/App.tsx

# Fix login screen icon colors
sed -i 's/bg-zinc-900 text-zinc-900/bg-zinc-900 text-white/g' src/App.tsx
