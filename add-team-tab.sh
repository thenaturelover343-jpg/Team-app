#!/bin/bash
sed -i "s/import { collection, query, onSnapshot, doc, setDoc } from 'firebase\/firestore';/import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase\/firestore';/g" src/AdminView.tsx

sed -i "s/useState<'planning' | 'timesheets' | 'customers'>('planning')/useState<'planning' | 'timesheets' | 'customers' | 'team'>('planning')/g" src/AdminView.tsx

# Add the TeamTab icon and button in the UI
sed -i '/<button\n          onClick={() => setActiveTab('"'"'customers'"'"')}/i \
        <button\
          onClick={() => setActiveTab('"'"'team'"'"')}\
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === '"'"'team'"'"' ? '"'"'bg-zinc-900 text-white shadow-md'"'"' : '"'"'text-zinc-600 hover:bg-zinc-100/50'"'"'}`}\
        >\
          <Users className="w-5 h-5" />\
          <span className="hidden sm:inline">Team</span>\
        </button>' src/AdminView.tsx

# Add the conditional rendering
sed -i '/{activeTab === '"'"'customers'"'"' && <CustomersTab customers={customers} \/>}/a \
      {activeTab === '"'"'team'"'"' && <TeamTab users={users} \/>}' src/AdminView.tsx

# Append TeamTab component
cat team_tab_code.tsx >> src/AdminView.tsx
