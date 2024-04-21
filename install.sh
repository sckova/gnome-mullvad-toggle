#!/bin/bash

# Compile schemas
glib-compile-schemas "src/schemas/"

# Delete existing copy of the extension
rm -rf ~/.local/share/gnome-shell/extensions/gnome-mullvad-toggle@kovacsmillio.gmail.com
mkdir -p ~/.local/share/gnome-shell/extensions/gnome-mullvad-toggle@kovacsmillio.gmail.com

#Copy extension source to the directory
cp -a "src/." ~/.local/share/gnome-shell/extensions/gnome-mullvad-toggle@kovacsmillio.gmail.com

echo "Please restart gnome shell"
