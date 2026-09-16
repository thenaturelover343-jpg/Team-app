#!/bin/bash
# Remove the early return
sed -i '/if (loading) {/,/  }/d' src/EmployeeView.tsx

# Find where activeShift is declared and insert the early return right before the return statement of DashboardTab, or just handle loading in the return JSX
