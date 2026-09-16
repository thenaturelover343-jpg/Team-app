#!/bin/bash
sed -i 's/import { db, handleFirestoreError, OperationType } from '\''\.\/lib\/firebase'\'';/import { db, handleFirestoreError, OperationType } from '\''\.\/lib\/firebase'\'';/g' src/AdminView.tsx
rm team_tab_code.tsx
