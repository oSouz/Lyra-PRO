cmake_minimum_required(VERSION 3.20)
project(souz_spout_sender LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
# Gerar com -DSPOUT_ROOT=C:/Spout2 (clone da biblioteca oficial).
if(NOT DEFINED SPOUT_ROOT)
  message(FATAL_ERROR "Passe -DSPOUT_ROOT=C:/caminho/Spout2")
endif()
add_executable(souz-spout-sender souz-spout-sender.cpp)
target_include_directories(souz-spout-sender PRIVATE "${SPOUT_ROOT}/SPOUTSDK/SpoutDirectX/SpoutDX" "${SPOUT_ROOT}/SPOUTSDK/SpoutGL")
# A biblioteca SpoutDX deve ter sido compilada pelo CMake do SDK.
find_library(SPOUT_DX_LIB NAMES SpoutDX SpoutDX_static
  PATHS "${SPOUT_ROOT}/BUILD/lib/Release" "${SPOUT_ROOT}/BUILD/lib" "${SPOUT_ROOT}/BUILD/Binaries" "${SPOUT_ROOT}/BUILD/Binaries/Release"
        "${SPOUT_ROOT}/INSTALL/lib" "${SPOUT_ROOT}/build/Release" "${SPOUT_ROOT}/build"
  REQUIRED)
target_link_libraries(souz-spout-sender PRIVATE "${SPOUT_DX_LIB}" d3d11 dxgi)
set_target_properties(souz-spout-sender PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}/build/Release")
foreach(cfg Release RelWithDebInfo Debug)
  string(TOUPPER ${cfg} cfg_upper)
  set_target_properties(souz-spout-sender PROPERTIES RUNTIME_OUTPUT_DIRECTORY_${cfg_upper} "${CMAKE_CURRENT_LIST_DIR}/build/Release")
endforeach()
