import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

try {
  const markdownText = 'This is my grocery list: - **Milk** - *Bread* - [Eggs](https://google.com)';
  console.log("Input:", markdownText);
  const html = renderToString(React.createElement(ReactMarkdown, null, markdownText));
  console.log("SUCCESS:", html);
} catch (e) {
  console.error("ERROR:", e);
}
