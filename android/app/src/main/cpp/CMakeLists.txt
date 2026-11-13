cmake_minimum_required(VERSION 3.22.1)
project(nexus_pty C)

add_library(nexus_pty SHARED nexus_pty.c)

target_compile_options(nexus_pty PRIVATE -O2 -Wall -Wextra)
target_link_options(nexus_pty PRIVATE "-Wl,-z,max-page-size=16384")

find_library(log-lib log)
target_link_libraries(nexus_pty ${log-lib})

