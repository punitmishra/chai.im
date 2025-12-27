//! UI rendering.

use crate::tui::app::{App, InputMode};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Frame,
};

/// Main draw function.
pub fn draw(f: &mut Frame, app: &App) {
    // Create main layout
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Length(30), // Sidebar
            Constraint::Min(40),    // Chat area
        ])
        .split(f.size());

    draw_sidebar(f, app, chunks[0]);
    draw_chat_area(f, app, chunks[1]);
}

fn draw_sidebar(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Min(10),   // Conversations
            Constraint::Length(3), // Status
        ])
        .split(area);

    // Header
    let header = Paragraph::new("  Chai.im")
        .style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(header, chunks[0]);

    // Conversation list
    let items: Vec<ListItem> = app
        .conversations
        .iter()
        .enumerate()
        .map(|(i, conv)| {
            let style = if i == app.selected_conversation {
                Style::default().bg(Color::DarkGray).fg(Color::White)
            } else {
                Style::default()
            };

            let online_indicator = if conv.online { "●" } else { "○" };
            let unread = if conv.unread_count > 0 {
                format!(" ({})", conv.unread_count)
            } else {
                String::new()
            };

            let content = format!("{} {}{}", online_indicator, conv.name, unread);
            ListItem::new(content).style(style)
        })
        .collect();

    let list = List::new(items).block(Block::default().borders(Borders::ALL).title(" Chats "));
    f.render_widget(list, chunks[1]);

    // Status bar
    let status_style = if app.connected {
        Style::default().fg(Color::Green)
    } else {
        Style::default().fg(Color::Red)
    };
    let status = Paragraph::new(app.status.as_str())
        .style(status_style)
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(status, chunks[2]);
}

fn draw_chat_area(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Min(10),   // Messages
            Constraint::Length(3), // Input
        ])
        .split(area);

    // Chat header
    let current_conv = app.conversations.get(app.selected_conversation);
    let header_title = current_conv
        .map(|c| c.name.as_str())
        .unwrap_or("No conversation selected");
    let header = Paragraph::new(header_title)
        .style(Style::default().add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(header, chunks[0]);

    // Messages
    draw_messages(f, app, chunks[1]);

    // Input area
    draw_input(f, app, chunks[2]);
}

fn draw_messages(f: &mut Frame, app: &App, area: Rect) {
    let messages: Vec<ListItem> = app
        .messages()
        .iter()
        .map(|msg| {
            let style = if msg.is_self {
                Style::default().fg(Color::Cyan)
            } else {
                Style::default().fg(Color::White)
            };

            let header = format!("{} [{}]", msg.sender, msg.timestamp);
            let content = render_message_content(&msg.content);

            let lines: Vec<Line> = std::iter::once(Line::from(Span::styled(
                header,
                style.add_modifier(Modifier::BOLD),
            )))
            .chain(content.lines.into_iter())
            .collect();

            ListItem::new(lines)
        })
        .collect();

    let messages_list =
        List::new(messages).block(Block::default().borders(Borders::ALL).title(" Messages "));
    f.render_widget(messages_list, area);
}

fn render_message_content(content: &str) -> Text<'static> {
    let mut lines = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        if line.starts_with("```") {
            if in_code_block {
                in_code_block = false;
                lines.push(Line::from(Span::styled(
                    "└───────────────────┘",
                    Style::default().fg(Color::DarkGray),
                )));
            } else {
                in_code_block = true;
                let code_lang = line.trim_start_matches("```");
                let header = format!("┌─── {} ───────────┐", code_lang);
                lines.push(Line::from(Span::styled(
                    header,
                    Style::default().fg(Color::DarkGray),
                )));
            }
        } else if in_code_block {
            lines.push(Line::from(Span::styled(
                format!("│ {}", line),
                Style::default().fg(Color::Green),
            )));
        } else {
            lines.push(Line::from(format!("  {}", line)));
        }
    }

    Text::from(lines)
}

fn draw_input(f: &mut Frame, app: &App, area: Rect) {
    let (title, style) = match app.input_mode {
        InputMode::Normal => (" Press 'i' to type ", Style::default().fg(Color::DarkGray)),
        InputMode::Editing => (
            " Type message (ESC to cancel) ",
            Style::default().fg(Color::Yellow),
        ),
        InputMode::Command => (" Command ", Style::default().fg(Color::Magenta)),
    };

    let prefix = if app.input_mode == InputMode::Command {
        ":"
    } else {
        ""
    };

    let input = Paragraph::new(format!("{}{}", prefix, app.input))
        .style(style)
        .block(Block::default().borders(Borders::ALL).title(title));
    f.render_widget(input, area);

    // Show cursor in editing mode
    if app.input_mode == InputMode::Editing || app.input_mode == InputMode::Command {
        let prefix_len = if app.input_mode == InputMode::Command {
            1
        } else {
            0
        };
        f.set_cursor(
            area.x + 1 + prefix_len + app.cursor_position as u16,
            area.y + 1,
        );
    }
}
