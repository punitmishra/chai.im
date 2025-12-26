//! Custom widgets.

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    widgets::Widget,
};
use syntect::highlighting::ThemeSet;
use syntect::parsing::SyntaxSet;

/// A syntax-highlighted code block widget.
pub struct CodeBlock<'a> {
    code: &'a str,
    language: &'a str,
}

impl<'a> CodeBlock<'a> {
    pub fn new(code: &'a str, language: &'a str) -> Self {
        Self { code, language }
    }
}

impl<'a> Widget for CodeBlock<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let ps = SyntaxSet::load_defaults_newlines();
        let ts = ThemeSet::load_defaults();

        // Look up syntax and theme for future highlighting support
        let _syntax = ps
            .find_syntax_by_token(self.language)
            .unwrap_or_else(|| ps.find_syntax_plain_text());
        let _theme = &ts.themes["base16-ocean.dark"];

        // Simple rendering without full highlighting for now
        for (i, line) in self.code.lines().enumerate() {
            if i >= area.height as usize {
                break;
            }

            let y = area.y + i as u16;
            let style = Style::default().fg(Color::Green);

            for (j, ch) in line.chars().enumerate() {
                if j >= area.width as usize {
                    break;
                }
                buf.set_string(area.x + j as u16, y, ch.to_string(), style);
            }
        }
    }
}

/// Convert syntect style to ratatui color.
fn syntect_to_ratatui_color(color: syntect::highlighting::Color) -> Color {
    Color::Rgb(color.r, color.g, color.b)
}
