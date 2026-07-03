import React, { useState } from 'react';
import './Calendar.css';

export default function Calendar({ tasks, selectedDate, onSelectDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Convert task creation dates (UTC) to local dates for the calendar dots
  const taskDates = tasks.map(task => task.created_at ? new Date(task.created_at + 'Z') : null).filter(Boolean);

  const hasTaskOnDate = (date) => {
    return taskDates.some(taskDate => isSameDay(taskDate, date));
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(year, month, day);
    if (selectedDate && isSameDay(selectedDate, clickedDate)) {
      onSelectDate(null); // deselect if already selected
    } else {
      onSelectDate(clickedDate);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(year, month, d);
    const isSelected = selectedDate && isSameDay(selectedDate, thisDate);
    const hasTask = hasTaskOnDate(thisDate);
    
    days.push(
      <div 
        key={d} 
        className={`calendar-day ${isSelected ? 'selected' : ''}`}
        onClick={() => handleDateClick(d)}
      >
        <span>{d}</span>
        {hasTask && <div className="calendar-dot"></div>}
      </div>
    );
  }

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button className="calendar-nav" onClick={prevMonth}>‹</button>
        <div className="calendar-title">{monthNames[month]} {year}</div>
        <button className="calendar-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="calendar-grid">
        <div className="calendar-weekday">Su</div>
        <div className="calendar-weekday">Mo</div>
        <div className="calendar-weekday">Tu</div>
        <div className="calendar-weekday">We</div>
        <div className="calendar-weekday">Th</div>
        <div className="calendar-weekday">Fr</div>
        <div className="calendar-weekday">Sa</div>
        {days}
      </div>
      {selectedDate && (
        <button className="calendar-clear" onClick={() => onSelectDate(null)}>
          Clear Filter
        </button>
      )}
    </div>
  );
}
