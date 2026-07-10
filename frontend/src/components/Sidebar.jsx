import React from 'react';
import Calendar from './Calendar';

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  tasks,
  selectedDate,
  setSelectedDate
}) {
  return (
    <>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <div className={`hidden-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <Calendar
          tasks={tasks}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setIsSidebarOpen(false);
          }}
        />
      </div>
    </>
  );
}
