//! UI rendering.

use crate::tui::app::{App, InputMode, Screen};
use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

/// Main draw function.
pub fn draw(f: &mut Frame, app: &App) {
    match &app.screen {
        Screen::Welcome => draw_welcome(f, app),
        Screen::Register => draw_register(f, app),
        Screen::Login => draw_login(f, app),
        Screen::MnemonicDisplay(mnemonic) => draw_mnemonic_display(f, app, mnemonic),
        Screen::MnemonicInput => draw_mnemonic_input(f, app),
        Screen::Chat => draw_chat(f, app),
    }
}

/// Draw welcome/landing screen.
fn draw_welcome(f: &mut Frame, app: &App) {
    let area = f.size();

    // Center the content
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(30),
            Constraint::Length(15),
            Constraint::Percentage(30),
        ])
        .split(area);

    let content_area = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20),
            Constraint::Percentage(60),
            Constraint::Percentage(20),
        ])
        .split(chunks[1])[1];

    let text = vec![
        Line::from(Span::styled(
            "  ☕ Chai.im",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from("  Secure, end-to-end encrypted messaging"),
        Line::from(""),
        Line::from(""),
        Line::from(Span::styled(
            "  [R] Register new account",
            Style::default().fg(Color::Green),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "  [L] Login with recovery phrase",
            Style::default().fg(Color::Cyan),
        )),
        Line::from(""),
        Line::from(""),
        Line::from(Span::styled(
            "  Press Ctrl+Q to quit",
            Style::default().fg(Color::DarkGray),
        )),
    ];

    let paragraph = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Yellow))
                .title(" Welcome "),
        )
        .alignment(Alignment::Left);

    f.render_widget(paragraph, content_area);

    // Status at bottom
    draw_status_bar(f, app, area);
}

/// Draw registration screen.
fn draw_register(f: &mut Frame, app: &App) {
    let area = f.size();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(30),
            Constraint::Length(10),
            Constraint::Percentage(30),
        ])
        .split(area);

    let content_area = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20),
            Constraint::Percentage(60),
            Constraint::Percentage(20),
        ])
        .split(chunks[1])[1];

    let mut text = vec![
        Line::from(Span::styled(
            "  Create Account",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from("  Choose a username (alphanumeric + underscore):"),
        Line::from(""),
        Line::from(format!("  > {}_", app.auth_username)),
        Line::from(""),
    ];

    if let Some(error) = &app.auth_error {
        text.push(Line::from(Span::styled(
            format!("  Error: {}", error),
            Style::default().fg(Color::Red),
        )));
    } else {
        text.push(Line::from(Span::styled(
            "  Press Enter to continue, ESC to go back",
            Style::default().fg(Color::DarkGray),
        )));
    }

    let paragraph = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Green))
                .title(" Register "),
        )
        .alignment(Alignment::Left);

    f.render_widget(paragraph, content_area);
    draw_status_bar(f, app, area);

    // Set cursor position
    f.set_cursor(
        content_area.x + 5 + app.auth_username.len() as u16,
        content_area.y + 5,
    );
}

/// Draw login screen.
fn draw_login(f: &mut Frame, app: &App) {
    let area = f.size();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(30),
            Constraint::Length(10),
            Constraint::Percentage(30),
        ])
        .split(area);

    let content_area = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20),
            Constraint::Percentage(60),
            Constraint::Percentage(20),
        ])
        .split(chunks[1])[1];

    let mut text = vec![
        Line::from(Span::styled(
            "  Login",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from("  Enter your username:"),
        Line::from(""),
        Line::from(format!("  > {}_", app.auth_username)),
        Line::from(""),
    ];

    if let Some(error) = &app.auth_error {
        text.push(Line::from(Span::styled(
            format!("  Error: {}", error),
            Style::default().fg(Color::Red),
        )));
    } else {
        text.push(Line::from(Span::styled(
            "  Press Enter to continue, ESC to go back",
            Style::default().fg(Color::DarkGray),
        )));
    }

    let paragraph = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan))
                .title(" Login "),
        )
        .alignment(Alignment::Left);

    f.render_widget(paragraph, content_area);
    draw_status_bar(f, app, area);

    f.set_cursor(
        content_area.x + 5 + app.auth_username.len() as u16,
        content_area.y + 5,
    );
}

/// Draw mnemonic display screen.
fn draw_mnemonic_display(f: &mut Frame, app: &App, mnemonic: &str) {
    let area = f.size();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(15),
            Constraint::Length(20),
            Constraint::Percentage(15),
        ])
        .split(area);

    let content_area = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(10),
            Constraint::Percentage(80),
            Constraint::Percentage(10),
        ])
        .split(chunks[1])[1];

    // Format mnemonic as numbered grid
    let words: Vec<&str> = mnemonic.split_whitespace().collect();
    let mut mnemonic_lines = vec![
        Line::from(Span::styled(
            "  Your Recovery Phrase",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "  ⚠️  Write these words down and keep them safe!",
            Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            "  Anyone with this phrase can access your account.",
            Style::default().fg(Color::Red),
        )),
        Line::from(""),
    ];

    // Display words in 4 columns of 6
    for row in 0..6 {
        let mut line_spans = vec![Span::raw("  ")];
        for col in 0..4 {
            let idx = row + col * 6;
            if idx < words.len() {
                let word_text = format!("{:>2}. {:<12}", idx + 1, words[idx]);
                line_spans.push(Span::styled(
                    word_text,
                    Style::default().fg(Color::Green),
                ));
            }
        }
        mnemonic_lines.push(Line::from(line_spans));
    }

    mnemonic_lines.push(Line::from(""));

    if app.auth_loading {
        mnemonic_lines.push(Line::from(Span::styled(
            "  Registering...",
            Style::default().fg(Color::Yellow),
        )));
    } else {
        mnemonic_lines.push(Line::from(Span::styled(
            "  Press Enter when you've saved your phrase",
            Style::default().fg(Color::Cyan),
        )));
    }

    let paragraph = Paragraph::new(mnemonic_lines)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Yellow))
                .title(" Recovery Phrase "),
        )
        .alignment(Alignment::Left);

    f.render_widget(paragraph, content_area);
    draw_status_bar(f, app, area);
}

/// Draw mnemonic input screen.
fn draw_mnemonic_input(f: &mut Frame, app: &App) {
    let area = f.size();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(20),
            Constraint::Length(14),
            Constraint::Percentage(20),
        ])
        .split(area);

    let content_area = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(10),
            Constraint::Percentage(80),
            Constraint::Percentage(10),
        ])
        .split(chunks[1])[1];

    let word_count = app.auth_mnemonic.split_whitespace().count();

    let mut text = vec![
        Line::from(Span::styled(
            "  Enter Recovery Phrase",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(format!("  Words entered: {}/24", word_count)),
        Line::from(""),
    ];

    // Show entered words wrapped
    let display_text = if app.auth_mnemonic.is_empty() {
        "Type your 24-word recovery phrase...".to_string()
    } else {
        app.auth_mnemonic.clone()
    };

    text.push(Line::from(Span::styled(
        format!("  {}", display_text),
        Style::default().fg(Color::Green),
    )));
    text.push(Line::from(""));

    if let Some(error) = &app.auth_error {
        text.push(Line::from(Span::styled(
            format!("  Error: {}", error),
            Style::default().fg(Color::Red),
        )));
    } else if app.auth_loading {
        text.push(Line::from(Span::styled(
            "  Logging in...",
            Style::default().fg(Color::Yellow),
        )));
    } else {
        text.push(Line::from(Span::styled(
            "  Separate words with spaces. Press Enter when done.",
            Style::default().fg(Color::DarkGray),
        )));
    }

    let paragraph = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan))
                .title(" Recovery Phrase "),
        )
        .wrap(Wrap { trim: false })
        .alignment(Alignment::Left);

    f.render_widget(paragraph, content_area);
    draw_status_bar(f, app, area);
}

/// Draw main chat screen.
fn draw_chat(f: &mut Frame, app: &App) {
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

    // Header with username
    let username = app.config.username.as_deref().unwrap_or("Anonymous");
    let header = Paragraph::new(format!("  ☕ {} ", username))
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
            let typing_indicator = if conv.typing { " ..." } else { "" };
            let unread = if conv.unread_count > 0 {
                format!(" ({})", conv.unread_count)
            } else {
                String::new()
            };

            let content = format!(
                "{} {}{}{}",
                online_indicator, conv.name, typing_indicator, unread
            );
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
        .map(|c| {
            if c.typing {
                format!("{} (typing...)", c.name)
            } else {
                c.name.clone()
            }
        })
        .unwrap_or_else(|| "No conversation selected".to_string());

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

            let status_icon = if msg.is_self {
                format!(" {}", msg.status.icon())
            } else {
                String::new()
            };

            let header = format!("{} [{}]{}", msg.sender, msg.timestamp, status_icon);
            let content = render_message_content(&msg.content);

            let lines: Vec<Line> = std::iter::once(Line::from(Span::styled(
                header,
                style.add_modifier(Modifier::BOLD),
            )))
            .chain(content.lines)
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

/// Draw status bar at bottom of screen.
fn draw_status_bar(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(0), Constraint::Length(1)])
        .split(area);

    let status = Paragraph::new(app.status.as_str())
        .style(Style::default().fg(Color::DarkGray))
        .alignment(Alignment::Center);

    f.render_widget(status, chunks[1]);
}
