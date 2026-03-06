# Project Blueprint

## Overview

This project is a personal stock portfolio tracker. It allows users to add and monitor US stocks of their choice. The application is inspired by financial data screening websites but provides a personalized experience.

## Implemented Features

### Initial Setup
*   **HTML Structure:** A basic HTML file (`index.html`) with a header, a form for adding stocks, and a container for the stock list.
*   **CSS Styling:** A stylesheet (`style.css`) for a clean and modern user interface.
*   **JavaScript Logic:** A JavaScript file (`main.js`) to handle user interactions.

## Current Plan

### Create a Personalized Stock Tracker

**Goal:** Build a web application where users can add and view US stock tickers.

**Steps:**

1.  **Create the main application layout in `index.html`:**
    *   Add a header with the title "My Stock Portfolio".
    *   Create a form with a text input for the stock ticker and an "Add Stock" button.
    *   Create a `div` with an id `stock-list` to hold the stock cards.

2.  **Style the application in `style.css`:**
    *   Apply a modern design with a clean layout, good spacing, and a clear visual hierarchy.
    *   Use CSS variables for colors to make theming easier.
    *   Style the input form and the stock list.

3.  **Implement the core logic in `main.js`:**
    *   Create a Web Component named `stock-card` to display information for a single stock. For now, it will just display the ticker symbol.
    *   Add an event listener to the "Add Stock" button.
    *   When the button is clicked, get the ticker from the input field.
    *   Create a new `<stock-card>` element with the ticker as an attribute.
    *   Append the new element to the `stock-list` container.
    *   Clear the input field.
