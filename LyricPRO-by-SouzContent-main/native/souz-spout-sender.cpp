// Souz Pro Lyric v0.3 - emissor Spout2 DirectX 11.
// Modos: stdin BGRA do Electron; --test-pattern gera quadros sem Electron.
// Spout2 SDK externo, licença BSD-2-Clause.
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <thread>
#include <vector>
#include "SpoutDX.h"
#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

static bool readFull(void* dst, size_t len) {
  auto* p=static_cast<unsigned char*>(dst);
  while(len) {
    const size_t got=fread(p,1,len,stdin);
    if(got==0) return false;
    p+=got;
    len-=got;
  }
  return true;
}
static void makePattern(std::vector<unsigned char>& data, unsigned w, unsigned h, unsigned frame) {
  // BGRA: faixas de transparência e movimento. Permite validar canal alfa no Resolume.
  for(unsigned y=0;y<h;y++) for(unsigned x=0;x<w;x++) {
    const size_t p=(static_cast<size_t>(y)*w+x)*4;
    const unsigned band=((x+frame*5)/100)%5;
    data[p+0]=static_cast<unsigned char>(band==0?255:25);   // B
    data[p+1]=static_cast<unsigned char>(band==1?240:60);   // G
    data[p+2]=static_cast<unsigned char>(band==2?245:40);   // R
    data[p+3]=static_cast<unsigned char>(band==3?0:band==4?96:255); // A
  }
}
int main(int argc,char** argv) {
  if(argc<4) {
    fprintf(stderr,"Uso: souz-spout-sender.exe LARGURA ALTURA NOME [--test-pattern]\n");
    return 2;
  }
  const unsigned w=static_cast<unsigned>(std::strtoul(argv[1],nullptr,10));
  const unsigned h=static_cast<unsigned>(std::strtoul(argv[2],nullptr,10));
  if(w<16||h<16||w>7680||h>4320){fprintf(stderr,"SOUZ_ERROR dimensoes invalidas\n");return 3;}
  const bool test=argc>=5 && std::strcmp(argv[4],"--test-pattern")==0;
#ifdef _WIN32
  _setmode(_fileno(stdin),_O_BINARY);
#endif
  setvbuf(stderr,nullptr,_IONBF,0);
  spoutDX spout;
  if(!spout.OpenDirectX11()){fprintf(stderr,"SOUZ_ERROR OpenDirectX11\n");return 4;}
  if(!spout.SetSenderName(argv[3])){fprintf(stderr,"SOUZ_ERROR SetSenderName\n");spout.CloseDirectX11();return 5;}
  spout.SetSenderFormat(DXGI_FORMAT_B8G8R8A8_UNORM);
  fprintf(stderr,"SOUZ_INIT nome=%s tamanho=%ux%u modo=%s\n",argv[3],w,h,test?"teste":"stdin");
  const size_t expected=static_cast<size_t>(w)*h*4;
  std::vector<unsigned char> pixels(expected);
  uint32_t header[3]={};
  unsigned long long frames=0;
  int result=0;
  auto lastReport=std::chrono::steady_clock::now();
  unsigned long long reportFrames=0;
  double sendMsAccum=0.0;
  while(true) {
    if(test) makePattern(pixels,w,h,static_cast<unsigned>(frames));
    else {
      if(!readFull(header,sizeof(header))) break;
      if(header[0]!=w || header[1]!=h || header[2]!=expected){
        fprintf(stderr,"SOUZ_ERROR frame inesperado: %u x %u / %u bytes, esperado %zu\n",header[0],header[1],header[2],expected);
        result=6;break;
      }
      if(!readFull(pixels.data(),pixels.size())){fprintf(stderr,"SOUZ_ERROR frame incompleto\n");result=7;break;}
      if(frames==0) fprintf(stderr,"SOUZ_FRAME primeiro frame recebido (%zu bytes)\n",expected);
    }
    const auto sendStart=std::chrono::steady_clock::now();
    if(!spout.SendImage(pixels.data(),w,h,w*4)){
      fprintf(stderr,"SOUZ_ERROR SendImage quadro=%llu\n",frames+1);
      result=8;break;
    }
    sendMsAccum+=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-sendStart).count();
    frames++;
    if(frames==1) {
      fprintf(stderr,"SOUZ_READY primeiro quadro publicado; initialized=%d sender=%s\n",spout.IsInitialized()?1:0,spout.GetName());
    }
    const auto current=std::chrono::steady_clock::now();
    const double elapsed=std::chrono::duration<double>(current-lastReport).count();
    if(elapsed>=1.0) {
      const unsigned long long sample=frames-reportFrames;
      fprintf(stderr,"SOUZ_STATS frames=%llu fps=%.1f send_ms=%.2f initialized=%d\n",
        frames, sample/elapsed, sample?sendMsAccum/sample:0.0,spout.IsInitialized()?1:0);
      reportFrames=frames;lastReport=current;sendMsAccum=0.0;
    }
    if(test) std::this_thread::sleep_for(std::chrono::milliseconds(33));
  }
  fprintf(stderr,"SOUZ_STOP frames=%llu resultado=%d\n",frames,result);
  spout.ReleaseSender();
  spout.CloseDirectX11();
  return result;
}
