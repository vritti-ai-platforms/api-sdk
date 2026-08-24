import { BrevoClient, BrevoError, BrevoTimeoutError } from '@getbrevo/brevo';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pluralize } from '../pluralize';

// Email-safe font stacks. Web fonts only land in clients that allow them; the fallbacks carry the rest.
const EMAIL_SANS = "'IBM Plex Sans',Helvetica,Arial,sans-serif";
const EMAIL_MONO = "'JetBrains Mono','Courier New',Courier,monospace";

// Brand marks inlined from apps/cloud-web/src/assets/vritti_cloud_{light,dark}.svg, sized for the email
// header (viewBox 407x67 -> 170x28). Inline SVG renders in Apple Mail and iOS Mail; Gmail, Outlook and
// Yahoo strip <svg> from email bodies, so configure EMAIL_LOGO_LIGHT_URL with a hosted PNG to reach those.
const VRITTI_CLOUD_LOGO_LIGHT = `<svg width="170" height="28" viewBox="0 0 407 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M78.9948 52L66.7748 37.44H72.2868L84.5588 51.948V52H78.9948ZM47.3788 52V14.612H78.5788C79.7228 14.612 80.7628 14.9067 81.6988 15.496C82.6695 16.0507 83.4321 16.796 83.9868 17.732C84.5415 18.668 84.8188 19.708 84.8188 20.852V31.824C84.8188 32.968 84.5415 34.008 83.9868 34.944C83.4321 35.88 82.6695 36.6427 81.6988 37.232C80.7628 37.7867 79.7228 38.064 78.5788 38.064H51.5908V52H47.3788ZM53.6188 33.8H78.5788C79.1335 33.8 79.6015 33.6093 79.9828 33.228C80.3988 32.8467 80.6068 32.3787 80.6068 31.824V20.852C80.6068 20.2973 80.3988 19.8293 79.9828 19.448C79.6015 19.032 79.1335 18.824 78.5788 18.824H53.6188C53.0641 18.824 52.5788 19.032 52.1628 19.448C51.7815 19.8293 51.5908 20.2973 51.5908 20.852V31.824C51.5908 32.3787 51.7815 32.8467 52.1628 33.228C52.5788 33.6093 53.0641 33.8 53.6188 33.8ZM90.809 52V14.56H95.073V52H90.809ZM116.178 52V18.772H99.538V14.56H136.978V18.772H120.39V52H116.178ZM155.635 52V18.772H138.995V14.56H176.435V18.772H159.847V52H155.635ZM180.844 52V14.56H185.108V52H180.844Z" fill="#0066CC"/><path d="M218.027 50.336C215.479 49.244 213.295 47.736 211.371 45.864C209.499 43.94 207.991 41.756 206.899 39.208C205.807 36.66 205.235 34.008 205.235 31.2C205.235 28.34 205.807 25.636 206.899 23.088C207.991 20.592 209.499 18.408 211.371 16.536C213.295 14.612 215.479 13.156 218.027 12.064C220.523 10.972 223.227 10.4 226.087 10.4C228.947 10.4 231.651 10.92 234.147 12.012C236.643 13.104 238.879 14.612 240.803 16.536L235.863 21.372C233.107 18.668 229.831 17.368 226.087 17.368C224.163 17.368 222.343 17.732 220.679 18.408C218.963 19.136 217.507 20.124 216.259 21.424C215.011 22.672 214.023 24.128 213.295 25.792C212.567 27.508 212.203 29.276 212.203 31.2C212.203 33.124 212.567 34.892 213.295 36.608C214.023 38.272 215.011 39.728 216.311 40.976C217.559 42.276 219.015 43.264 220.679 43.992C222.395 44.668 224.163 45.032 226.087 45.032L234.147 50.388C231.651 51.48 228.947 52 226.087 52C223.227 52 220.523 51.428 218.027 50.336ZM252.177 45.032H272.977V52H245.261L252.177 45.032ZM245.261 10.4H252.177V11.544V35.62L245.261 42.588V11.544V10.4ZM295.636 10.4C301.408 10.4 306.244 12.48 310.3 16.536C314.408 20.592 316.488 25.48 316.488 31.2C316.488 36.972 314.408 41.86 310.3 45.864C306.244 49.92 301.408 52 295.636 52C289.864 52 285.028 49.92 280.972 45.864C276.916 41.808 274.836 36.972 274.836 31.2C274.836 25.48 276.916 20.592 280.972 16.536C284.976 12.48 289.864 10.4 295.636 10.4ZM295.636 17.368C291.84 17.368 288.564 18.668 285.808 21.424C283.104 24.128 281.804 27.404 281.804 31.2C281.804 34.996 283.104 38.324 285.808 41.028C288.512 43.732 291.84 45.032 295.636 45.032C299.432 45.032 302.708 43.732 305.412 41.028C308.168 38.272 309.468 34.996 309.468 31.2C309.468 27.404 308.116 24.128 305.412 21.424C302.708 18.72 299.432 17.368 295.636 17.368ZM352.723 34.684H359.639C359.639 39.468 357.975 43.576 354.543 46.956C351.163 50.336 347.003 52 342.271 52C337.539 52 333.431 50.336 330.051 46.956C326.671 43.576 325.007 39.416 325.007 34.684V10.4H331.923V34.684C331.923 37.544 332.911 39.988 334.887 41.964C336.915 44.044 339.411 45.032 342.271 45.032C345.131 45.032 347.575 43.992 349.603 41.964C351.631 39.936 352.723 37.492 352.723 34.684ZM396.621 23.192C397.713 25.688 398.233 28.34 398.233 31.2C398.233 34.06 397.713 36.712 396.621 39.208C395.477 41.756 394.021 43.94 392.149 45.864C390.277 47.736 388.041 49.244 385.493 50.336C382.997 51.428 380.293 52 377.433 52H363.601L370.517 45.032H377.433C379.357 45.032 381.177 44.668 382.841 43.992C384.505 43.264 386.013 42.276 387.261 40.976C388.509 39.676 389.497 38.22 390.225 36.556C390.953 34.84 391.317 33.072 391.317 31.2C391.317 29.328 390.953 27.56 390.225 25.844C389.497 24.18 388.509 22.724 387.209 21.424C385.961 20.176 384.453 19.136 382.789 18.408C381.125 17.732 379.305 17.368 377.433 17.368H370.517L363.601 10.4H377.433C380.293 10.4 382.945 10.972 385.493 12.064C387.989 13.156 390.225 14.664 392.097 16.536C394.021 18.46 395.477 20.644 396.621 23.192Z" fill="url(#paint0_linear_56_379)"/><path d="M7.99999 14H1.30874C0.614275 14.0193 0 14 0 14L18.8085 51.5C19.7652 52.3585 19.9594 52.3219 19.8087 51.5C19.3792 51.0014 19.4775 50.4593 20.3087 49C21.1421 46.2568 21.2304 43.8491 19.3087 41.5C18.2179 39.4696 18.9309 37.1826 20.8087 34L16.8087 26.5L14.8087 22.5L12.3087 18L11 15C10.5113 14.44 10.1886 14.2085 9.5 14H8.49999H7.99999Z" fill="url(#paint1_linear_56_379)"/><path d="M35.0507 14C37.2595 14.0004 39.0507 15.7911 39.0507 18C39.0507 20.2089 37.2595 21.9996 35.0507 22C34.4331 21.9999 33.8472 21.8594 33.3251 21.6094C33.1714 21.6936 33.0228 21.829 32.8553 22.0293L24.3583 35.0234C24.2882 35.1904 24.2274 35.3388 24.1805 35.4658C24.1331 35.5943 24.1019 35.6986 24.0927 35.7783C24.0834 35.8587 24.099 35.9018 24.1229 35.9238C24.1488 35.9469 24.2031 35.9626 24.3085 35.9502C26.1439 35.5539 27.4169 35.1177 28.4637 34.5029C29.5109 33.8878 30.3371 33.0905 31.2772 31.9678L33.3827 28.5957C33.1697 28.1068 33.0507 27.5673 33.0507 27C33.0507 24.791 34.8417 23.0002 37.0507 23C39.2597 23.0002 41.0507 24.791 41.0507 27C41.0507 29.0504 39.5075 30.7394 37.5194 30.9717C37.459 30.9962 37.397 31.0224 37.3339 31.0469L37.3173 31.0527L37.3007 31.0479C37.2448 31.0305 37.1894 31.0136 37.1356 30.9971C37.1076 30.9977 37.0789 31 37.0507 31C36.4652 30.9999 35.9092 30.8725 35.4081 30.6465C35.0278 30.6575 34.6938 30.7719 34.3505 31.0352L21.3573 51.5264L21.3534 51.5342L21.3466 51.5391C21.2336 51.6277 21.1425 51.6842 21.0507 51.6836C20.9809 51.6826 20.9167 51.6494 20.8505 51.5967L20.7821 51.5371C20.6425 51.4109 20.5854 51.2341 20.5887 51.0195C20.5921 50.8061 20.6543 50.5492 20.7577 50.2539C20.9644 49.664 21.3412 48.8997 21.7675 47.9834C22.0915 46.9083 22.1753 46.1149 22.0751 45.3691C21.9746 44.6219 21.6897 43.9177 21.2704 43.0215V43.0205C20.4116 41.1274 20.0867 40.2768 20.0155 39.6953C19.9796 39.4019 20.0079 39.1768 20.0624 38.9248C20.117 38.6719 20.1966 38.3975 20.2665 37.9912L20.2675 37.9824L20.2723 37.9736L31.2723 19.9736H31.2733C31.3431 19.8632 31.3907 19.7685 31.4198 19.6807C31.1829 19.1697 31.0507 18.6002 31.0507 18C31.0507 15.7911 32.8418 14.0004 35.0507 14ZM36.9999 25C35.8954 25.0001 34.9999 25.8955 34.9999 27C34.9999 28.1045 35.8954 28.9999 36.9999 29C38.1043 28.9999 38.9999 28.1045 38.9999 27C38.9999 25.8955 38.1043 25.0001 36.9999 25ZM34.9999 16C33.8953 16 32.9999 16.8954 32.9999 18C32.9999 19.1046 33.8953 20 34.9999 20C36.1044 19.9999 36.9999 19.1045 36.9999 18C36.9999 16.8955 36.1044 16.0001 34.9999 16Z" fill="url(#paint2_linear_56_379)"/><defs><linearGradient id="paint0_linear_56_379" x1="306" y1="5" x2="306" y2="67" gradientUnits="userSpaceOnUse"><stop stop-color="#9E9E9E"/><stop offset="1" stop-color="#464646"/></linearGradient><linearGradient id="paint1_linear_56_379" x1="19.5" y1="52" x2="0.999996" y2="16" gradientUnits="userSpaceOnUse"><stop stop-color="#0959B9"/><stop offset="1" stop-color="#1B74D1"/></linearGradient><linearGradient id="paint2_linear_56_379" x1="30.5245" y1="14" x2="30.5245" y2="51.6836" gradientUnits="userSpaceOnUse"><stop stop-color="#9E9E9E"/><stop offset="1" stop-color="#464646"/></linearGradient></defs></svg>`;

const VRITTI_CLOUD_LOGO_DARK = `<svg width="170" height="28" viewBox="0 0 407 67" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M78.9948 52L66.7748 37.44H72.2868L84.5588 51.948V52H78.9948ZM47.3788 52V14.612H78.5788C79.7228 14.612 80.7628 14.9067 81.6988 15.496C82.6695 16.0507 83.4321 16.796 83.9868 17.732C84.5415 18.668 84.8188 19.708 84.8188 20.852V31.824C84.8188 32.968 84.5415 34.008 83.9868 34.944C83.4321 35.88 82.6695 36.6427 81.6988 37.232C80.7628 37.7867 79.7228 38.064 78.5788 38.064H51.5908V52H47.3788ZM53.6188 33.8H78.5788C79.1335 33.8 79.6015 33.6093 79.9828 33.228C80.3988 32.8467 80.6068 32.3787 80.6068 31.824V20.852C80.6068 20.2973 80.3988 19.8293 79.9828 19.448C79.6015 19.032 79.1335 18.824 78.5788 18.824H53.6188C53.0641 18.824 52.5788 19.032 52.1628 19.448C51.7815 19.8293 51.5908 20.2973 51.5908 20.852V31.824C51.5908 32.3787 51.7815 32.8467 52.1628 33.228C52.5788 33.6093 53.0641 33.8 53.6188 33.8ZM90.809 52V14.56H95.073V52H90.809ZM116.178 52V18.772H99.538V14.56H136.978V18.772H120.39V52H116.178ZM155.635 52V18.772H138.995V14.56H176.435V18.772H159.847V52H155.635ZM180.844 52V14.56H185.108V52H180.844Z" fill="#0066CC"/><path d="M218.027 50.336C215.479 49.244 213.295 47.736 211.371 45.864C209.499 43.94 207.991 41.756 206.899 39.208C205.807 36.66 205.235 34.008 205.235 31.2C205.235 28.34 205.807 25.636 206.899 23.088C207.991 20.592 209.499 18.408 211.371 16.536C213.295 14.612 215.479 13.156 218.027 12.064C220.523 10.972 223.227 10.4 226.087 10.4C228.947 10.4 231.651 10.92 234.147 12.012C236.643 13.104 238.879 14.612 240.803 16.536L235.863 21.372C233.107 18.668 229.831 17.368 226.087 17.368C224.163 17.368 222.343 17.732 220.679 18.408C218.963 19.136 217.507 20.124 216.259 21.424C215.011 22.672 214.023 24.128 213.295 25.792C212.567 27.508 212.203 29.276 212.203 31.2C212.203 33.124 212.567 34.892 213.295 36.608C214.023 38.272 215.011 39.728 216.311 40.976C217.559 42.276 219.015 43.264 220.679 43.992C222.395 44.668 224.163 45.032 226.087 45.032L234.147 50.388C231.651 51.48 228.947 52 226.087 52C223.227 52 220.523 51.428 218.027 50.336ZM252.177 45.032H272.977V52H245.261L252.177 45.032ZM245.261 10.4H252.177V11.544V35.62L245.261 42.588V11.544V10.4ZM295.636 10.4C301.408 10.4 306.244 12.48 310.3 16.536C314.408 20.592 316.488 25.48 316.488 31.2C316.488 36.972 314.408 41.86 310.3 45.864C306.244 49.92 301.408 52 295.636 52C289.864 52 285.028 49.92 280.972 45.864C276.916 41.808 274.836 36.972 274.836 31.2C274.836 25.48 276.916 20.592 280.972 16.536C284.976 12.48 289.864 10.4 295.636 10.4ZM295.636 17.368C291.84 17.368 288.564 18.668 285.808 21.424C283.104 24.128 281.804 27.404 281.804 31.2C281.804 34.996 283.104 38.324 285.808 41.028C288.512 43.732 291.84 45.032 295.636 45.032C299.432 45.032 302.708 43.732 305.412 41.028C308.168 38.272 309.468 34.996 309.468 31.2C309.468 27.404 308.116 24.128 305.412 21.424C302.708 18.72 299.432 17.368 295.636 17.368ZM352.723 34.684H359.639C359.639 39.468 357.975 43.576 354.543 46.956C351.163 50.336 347.003 52 342.271 52C337.539 52 333.431 50.336 330.051 46.956C326.671 43.576 325.007 39.416 325.007 34.684V10.4H331.923V34.684C331.923 37.544 332.911 39.988 334.887 41.964C336.915 44.044 339.411 45.032 342.271 45.032C345.131 45.032 347.575 43.992 349.603 41.964C351.631 39.936 352.723 37.492 352.723 34.684ZM396.621 23.192C397.713 25.688 398.233 28.34 398.233 31.2C398.233 34.06 397.713 36.712 396.621 39.208C395.477 41.756 394.021 43.94 392.149 45.864C390.277 47.736 388.041 49.244 385.493 50.336C382.997 51.428 380.293 52 377.433 52H363.601L370.517 45.032H377.433C379.357 45.032 381.177 44.668 382.841 43.992C384.505 43.264 386.013 42.276 387.261 40.976C388.509 39.676 389.497 38.22 390.225 36.556C390.953 34.84 391.317 33.072 391.317 31.2C391.317 29.328 390.953 27.56 390.225 25.844C389.497 24.18 388.509 22.724 387.209 21.424C385.961 20.176 384.453 19.136 382.789 18.408C381.125 17.732 379.305 17.368 377.433 17.368H370.517L363.601 10.4H377.433C380.293 10.4 382.945 10.972 385.493 12.064C387.989 13.156 390.225 14.664 392.097 16.536C394.021 18.46 395.477 20.644 396.621 23.192Z" fill="url(#paint0_linear_92_90)"/><path d="M7.99999 14H1.30874C0.614275 14.0193 0 14 0 14L18.8085 51.5C19.7652 52.3585 19.9594 52.3219 19.8087 51.5C19.3792 51.0014 19.4775 50.4593 20.3087 49C21.1421 46.2568 21.2304 43.8491 19.3087 41.5C18.2179 39.4696 18.9309 37.1826 20.8087 34L16.8087 26.5L14.8087 22.5L12.3087 18L11 15C10.5113 14.44 10.1886 14.2085 9.5 14H8.49999H7.99999Z" fill="url(#paint1_linear_92_90)"/><path fill-rule="evenodd" clip-rule="evenodd" d="M35.0497 14C37.2588 14 39.0497 15.7909 39.0497 18C39.0497 20.2091 37.2588 22 35.0497 22C34.4321 21.9998 33.8463 21.8595 33.3241 21.6094C33.1708 21.6937 33.0224 21.8295 32.8554 22.0293L24.3583 35.0234C24.2882 35.1903 24.2274 35.3389 24.1805 35.4658C24.1332 35.5943 24.1019 35.6986 24.0927 35.7783C24.0834 35.8586 24.099 35.9018 24.1229 35.9238C24.1489 35.9468 24.2034 35.9625 24.3085 35.9502C26.1438 35.5539 27.4169 35.1177 28.4638 34.5029C29.5108 33.8878 30.3372 33.0905 31.2772 31.9678L33.3817 28.5967C33.1686 28.1076 33.0497 27.5675 33.0497 27C33.0497 24.7912 34.841 23.0006 37.0497 23C39.2588 23 41.0497 24.7909 41.0497 27C41.0497 29.0499 39.5078 30.7378 37.5204 30.9707C37.4596 30.9954 37.3974 31.0223 37.3339 31.0469L37.3173 31.0527L37.3007 31.0479C37.2448 31.0305 37.1894 31.0136 37.1356 30.9971C37.1074 30.9977 37.0781 31 37.0497 31C36.4643 30.9999 35.9082 30.8726 35.4071 30.6465C35.0273 30.6577 34.6935 30.7722 34.3505 31.0352L21.3573 51.5264L21.3534 51.5342L21.3466 51.5391C21.2337 51.6276 21.1424 51.6841 21.0507 51.6836C20.981 51.6826 20.9167 51.6493 20.8505 51.5967L20.7821 51.5371C20.6425 51.4109 20.5854 51.2341 20.5888 51.0195C20.5921 50.8061 20.6543 50.5492 20.7577 50.2539C20.9644 49.664 21.3413 48.8996 21.7675 47.9834C22.0915 46.9083 22.1753 46.1149 22.0751 45.3691C21.9746 44.6219 21.6897 43.9177 21.2704 43.0215V43.0205C20.4116 41.1274 20.0867 40.2768 20.0155 39.6953C19.9796 39.4019 20.008 39.1768 20.0624 38.9248C20.117 38.672 20.1966 38.3974 20.2665 37.9912L20.2675 37.9824L20.2723 37.9736L31.2723 19.9736H31.2733C31.3431 19.8632 31.3907 19.7685 31.4198 19.6807C31.1829 19.1697 31.0497 18.6003 31.0497 18C31.0497 15.7912 32.841 14.0006 35.0497 14ZM36.9999 25C35.8955 25.0002 34.9999 25.8956 34.9999 27C34.9999 28.1044 35.8955 28.9998 36.9999 29C38.1042 28.9998 38.9999 28.1044 38.9999 27C38.9999 25.8956 38.1042 25.0002 36.9999 25ZM34.9999 16C33.8953 16 32.9999 16.8954 32.9999 18C32.9999 19.1046 33.8953 20 34.9999 20C36.1044 19.9999 36.9999 19.1045 36.9999 18C36.9999 16.8955 36.1044 16.0001 34.9999 16Z" fill="url(#paint2_linear_92_90)"/><defs><linearGradient id="paint0_linear_92_90" x1="306" y1="5" x2="306" y2="67" gradientUnits="userSpaceOnUse"><stop stop-color="#D9D9D9"/><stop offset="1" stop-color="#737373"/></linearGradient><linearGradient id="paint1_linear_92_90" x1="19.5" y1="52" x2="0.999996" y2="16" gradientUnits="userSpaceOnUse"><stop stop-color="#0959B9"/><stop offset="1" stop-color="#1B74D1"/></linearGradient><linearGradient id="paint2_linear_92_90" x1="30.5246" y1="14" x2="30.5246" y2="51.6836" gradientUnits="userSpaceOnUse"><stop stop-color="#D9D9D9"/><stop offset="1" stop-color="#737373"/></linearGradient></defs></svg>`;

type EmailNoticeTone = 'warn' | 'danger' | 'success';
type EmailButtonTone = 'primary' | 'danger';

const EMAIL_NOTICE_TONES: Record<
  EmailNoticeTone,
  { background: string; color: string; boxClass: string; textClass: string }
> = {
  warn: { background: '#fdf6e7', color: '#8a6410', boxClass: 'e-warnbox', textClass: 'e-warn' },
  danger: { background: '#fdeceb', color: '#a32b21', boxClass: 'e-dangerbox', textClass: 'e-danger' },
  success: { background: '#eaf6ee', color: '#1c6b3f', boxClass: 'e-successbox', textClass: 'e-success' },
};

const EMAIL_BUTTON_TONES: Record<EmailButtonTone, string> = {
  primary: '#1b74d1',
  danger: '#c0392b',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoClient: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly logoLightUrl?: string;
  private readonly logoDarkUrl?: string;
  private readonly frontendBaseUrl?: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not configured. Email sending will fail.');
      throw new Error('Email service configuration error: Missing BREVO_API_KEY');
    }

    // Initialize Brevo client with built-in retry support
    this.brevoClient = new BrevoClient({ apiKey, maxRetries: 3 });

    // Get sender configuration
    const senderEmail = this.configService.get<string>('SENDER_EMAIL');
    const senderName = this.configService.get<string>('SENDER_NAME');

    if (!senderEmail || !senderName) {
      this.logger.error('Sender email or name is not configured.');
      throw new Error('Email service configuration error: Missing SENDER_EMAIL or SENDER_NAME');
    }

    this.senderEmail = senderEmail;
    this.senderName = senderName;

    // Hosted brand marks for email headers. Must be PNG - most clients block SVG.
    this.logoLightUrl = this.configService.get<string>('EMAIL_LOGO_LIGHT_URL');
    this.logoDarkUrl = this.configService.get<string>('EMAIL_LOGO_DARK_URL') || this.logoLightUrl;

    if (!this.logoLightUrl) {
      this.logger.warn(
        'EMAIL_LOGO_LIGHT_URL is not configured. Emails fall back to an inline SVG wordmark, which Gmail, Outlook and Yahoo strip.',
      );
    }

    // Base URL for links back into the web app. Optional at boot so consumers that send no
    // link-bearing emails still start; the senders that need it throw with a clear message.
    this.frontendBaseUrl = this.configService.get<string>('FRONTEND_BASE_URL')?.replace(/\/+$/, '');

    if (!this.frontendBaseUrl) {
      this.logger.warn('FRONTEND_BASE_URL is not configured. Emails containing web app links will fail to send.');
    }

    this.logger.log('Brevo email service initialized successfully');
  }

  // Sends an email verification OTP to the given recipient
  async sendVerificationEmail(email: string, otp: string, expiresAt: Date, displayName?: string): Promise<void> {
    const name = displayName || 'there';
    const expiry = this.formatExpiry(expiresAt);

    const htmlContent = this.renderEmailShell({
      preheader: `Your verification code is ${otp}. It expires in ${expiry}.`,
      heading: 'Verify Your Email',
      body: [
        this.emailText(`Hello ${name} &mdash; enter the code below to finish setting up your Vritti AI Cloud account.`),
        this.emailCode('Verification Code', otp),
        this.emailNotice(`This code expires ${expiry} after it was sent.`, 'warn'),
        this.emailDivider(),
        this.emailMuted(
          "Didn't request this? No account was created. You can ignore this email and the code will expire on its own.",
        ),
      ].join(''),
    });

    const textContent = this.renderTextShell([
      `Hello ${name},`,
      'Enter the code below to finish setting up your Vritti AI Cloud account.',
      `Verification Code: ${otp}`,
      `This code expires ${expiry} after it was sent.`,
      "Didn't request this? No account was created. You can ignore this email and the code will expire on its own.",
    ]);

    await this.sendEmail({
      to: [{ email, name }],
      subject: 'Verify Your Email - Vritti AI Cloud',
      htmlContent,
      textContent,
    });

    this.logger.log(`Verification email sent to ${email}`);
  }

  // Sends a password reset OTP to the given recipient
  async sendPasswordResetEmail(email: string, otp: string, expiresAt: Date, displayName?: string): Promise<void> {
    const name = displayName || 'there';
    const expiry = this.formatExpiry(expiresAt);

    const htmlContent = this.renderEmailShell({
      preheader: `Your password reset code is ${otp}. It expires in ${expiry}.`,
      heading: 'Reset Your Password',
      body: [
        this.emailText(
          `Hello ${name} &mdash; we received a request to reset your password. Enter the code below to choose a new one.`,
        ),
        this.emailCode('Reset Code', otp),
        this.emailNotice(`This code expires ${expiry} after it was sent.`, 'warn'),
        this.emailNotice(
          '<strong>Never share this code.</strong> Vritti will never ask you for it by email, phone or chat.',
          'danger',
        ),
        this.emailDivider(),
        this.emailMuted(
          "Didn't request a reset? You can ignore this email &mdash; your password stays unchanged and the code will expire on its own.",
        ),
      ].join(''),
    });

    const textContent = this.renderTextShell([
      `Hello ${name},`,
      'We received a request to reset your password. Enter the code below to choose a new one.',
      `Reset Code: ${otp}`,
      `This code expires ${expiry} after it was sent.`,
      'Never share this code. Vritti will never ask you for it by email, phone or chat.',
      "Didn't request a reset? You can ignore this email - your password stays unchanged and the code will expire on its own.",
    ]);

    await this.sendEmail({
      to: [{ email, name }],
      subject: 'Reset Your Password - Vritti AI Cloud',
      htmlContent,
      textContent,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  // Sends an email change notification to the old address with a revert link
  async sendEmailChangeNotification(
    oldEmail: string,
    newEmail: string,
    revertToken: string,
    revertExpiresAt: Date,
    displayName?: string,
  ): Promise<void> {
    const name = displayName || 'there';
    const hoursUntilExpiry = Math.floor((revertExpiresAt.getTime() - Date.now()) / 3_600_000);
    const window = `${hoursUntilExpiry} ${pluralize('hour', hoursUntilExpiry)}`;

    const revertLink = `${this.requireFrontendBaseUrl()}/settings/profile/revert-email?token=${revertToken}`;

    const htmlContent = this.renderEmailShell({
      preheader: `Your Vritti AI Cloud email address is now ${newEmail}.`,
      heading: 'Your Email Address Changed',
      body: [
        this.emailText(`Hello ${name} &mdash; the email address on your Vritti AI Cloud account has been changed.`),
        this.emailFields([
          { label: 'Previous Email', value: oldEmail },
          { label: 'New Email', value: newEmail },
        ]),
        this.emailNotice(
          `<strong>Didn't make this change?</strong> You can revert it within the next ${window}.`,
          'danger',
        ),
        this.emailButton(revertLink, 'Revert Email Change', 'danger'),
        this.emailDivider(),
        this.emailMuted('If you made this change yourself, no action is needed &mdash; you can ignore this email.'),
      ].join(''),
    });

    const textContent = this.renderTextShell([
      `Hello ${name},`,
      'The email address on your Vritti AI Cloud account has been changed.',
      `Previous Email: ${oldEmail}`,
      `New Email: ${newEmail}`,
      `Didn't make this change? You can revert it within the next ${window}:`,
      revertLink,
      'If you made this change yourself, no action is needed - you can ignore this email.',
    ]);

    await this.sendEmail({
      to: [{ email: oldEmail, name }],
      subject: 'Your Email Address Has Been Changed - Vritti AI Cloud',
      htmlContent,
      textContent,
    });

    this.logger.log(`Email change notification sent to ${oldEmail}`);
  }

  // Sends a confirmation to the restored email address after a revert
  async sendEmailRevertConfirmation(email: string, displayName?: string): Promise<void> {
    const name = displayName || 'there';

    const htmlContent = this.renderEmailShell({
      preheader: `Your Vritti AI Cloud email address is back to ${email}.`,
      heading: 'Email Change Reverted',
      body: [
        this.emailText(
          `Hello ${name} &mdash; the recent change to your email address has been reverted. Your account email is now:`,
        ),
        this.emailNotice(email, 'success', true),
        this.emailDivider(),
        this.emailMuted("Didn't request this revert? Contact our support team immediately."),
      ].join(''),
    });

    const textContent = this.renderTextShell([
      `Hello ${name},`,
      'The recent change to your email address has been reverted. Your account email is now:',
      email,
      "Didn't request this revert? Contact our support team immediately.",
    ]);

    await this.sendEmail({
      to: [{ email, name }],
      subject: 'Email Address Change Reverted - Vritti AI Cloud',
      htmlContent,
      textContent,
    });

    this.logger.log(`Email revert confirmation sent to ${email}`);
  }

  // Sends an invite email to a new portal user with their set-password link
  async sendInviteEmail(params: { to: string; name: string; inviteUrl: string }): Promise<void> {
    const { to, name, inviteUrl } = params;

    const htmlContent = this.renderEmailShell({
      preheader: 'Set your password to activate your Vritti AI Cloud account.',
      heading: "You're Invited",
      body: [
        this.emailText(
          `Hello ${name} &mdash; you've been invited to join Vritti AI Cloud. Set your password to activate your account.`,
        ),
        this.emailButton(inviteUrl, 'Set Your Password'),
        this.emailNotice('This invite link is single-use and expires once your password is set.', 'warn'),
        this.emailDivider(),
        this.emailMuted(
          `If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;">${inviteUrl}</span>`,
        ),
      ].join(''),
    });

    const textContent = this.renderTextShell([
      `Hello ${name},`,
      "You've been invited to join Vritti AI Cloud. Visit the link below to set your password and activate your account:",
      inviteUrl,
      'This invite link is single-use and expires once your password is set.',
    ]);

    await this.sendEmail({
      to: [{ email: to, name }],
      subject: 'You have been invited to Vritti AI',
      htmlContent,
      textContent,
    });

    this.logger.log(`Invite email sent to ${to}`);
  }

  // Sends a transactional email with custom subject, HTML, and text content
  async sendTransactionalEmail(params: {
    to: { email: string; name?: string };
    subject: string;
    htmlContent: string;
    textContent: string;
  }): Promise<void> {
    await this.sendEmail({
      to: [params.to],
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
    });
    this.logger.log(`Transactional email sent to ${params.to.email}`);
  }

  // Verifies Brevo API connectivity — a 400 response means the API is reachable
  async verifyConnection(): Promise<boolean> {
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        sender: { email: this.senderEmail, name: this.senderName },
        to: [{ email: this.senderEmail }],
        subject: 'Connection Test',
        htmlContent: '<p>Test</p>',
      });
      return true;
    } catch (err) {
      // A 400 error means the API is reachable but params are incomplete — still a successful connection test
      if (err instanceof BrevoError && err.statusCode === 400) {
        return true;
      }
      this.logger.error('Brevo connection verification failed:', err);
      return false;
    }
  }

  // Sends a transactional email via Brevo — retries handled internally by BrevoClient
  // Renders the shared transactional email shell: brand header, card, heading, body rows, footer
  private renderEmailShell(params: { preheader: string; heading: string; body: string }): string {
    const { preheader, heading, body } = params;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${heading}</title>
<!--[if mso]>
<style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<style>
  @media only screen and (max-width:620px){
    .m-pad{padding-left:24px !important;padding-right:24px !important;}
    .m-code{font-size:32px !important;letter-spacing:8px !important;}
    .m-h1{font-size:26px !important;line-height:32px !important;}
  }
  @media (prefers-color-scheme:dark){
    .e-bg{background-color:#0f1214 !important;}
    .e-card{background-color:#1c2126 !important;border-color:#2b3238 !important;}
    .e-h1{color:#f0f3f5 !important;}
    .e-body{color:#a3adb8 !important;}
    .e-panel{background-color:#14181c !important;border-color:#2b3238 !important;}
    .e-label{color:#8b96a2 !important;}
    .e-code{color:#63a8ee !important;}
    .e-value{color:#f0f3f5 !important;}
    .e-warnbox{background-color:#2a2317 !important;}
    .e-warn{color:#e0b45e !important;}
    .e-dangerbox{background-color:#2b1a18 !important;}
    .e-danger{color:#ef8a7f !important;}
    .e-successbox{background-color:#16261c !important;}
    .e-success{color:#5fc98a !important;}
    .e-rule{background-color:#2b3238 !important;}
    .e-muted{color:#8b96a2 !important;}
    .e-footer{color:#79838e !important;}
    .e-logo-light{display:none !important;}
    .e-logo-dark{display:block !important;}
  }
</style>
</head>
<body class="e-bg" style="margin:0;padding:0;background-color:#f7f9fb;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="e-bg" style="background-color:#f7f9fb;">
  <tr>
    <td align="center" style="padding:40px 12px 56px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

        <tr>
          <td style="padding:0 0 20px 2px;">
            ${this.renderEmailBrand()}
          </td>
        </tr>

        <tr>
          <td class="e-card" style="background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

              <tr>
                <td class="m-pad m-h1 e-h1" style="padding:40px 40px 0 40px;font-family:${EMAIL_SANS};font-size:28px;line-height:34px;mso-line-height-rule:exactly;color:#1b2434;font-weight:600;letter-spacing:-0.4px;">
                  ${heading}
                </td>
              </tr>
${body}
              <tr><td style="height:36px;line-height:36px;font-size:0;">&nbsp;</td></tr>

            </table>
          </td>
        </tr>

        <tr>
          <td class="m-pad e-footer" style="padding:22px 2px 0 2px;font-family:${EMAIL_SANS};font-size:12px;line-height:20px;mso-line-height-rule:exactly;color:#8a95a5;letter-spacing:0.01em;">
            Vritti AI Cloud<br>
            Automated message &mdash; replies aren't monitored.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>
    `.trim();
  }

  // Builds the plain-text alternative from the same blocks the HTML shell renders
  private renderTextShell(blocks: string[]): string {
    const footer = ['---', 'Vritti AI Cloud', "Automated message - replies aren't monitored."].join('\n');
    return [...blocks, footer].join('\n\n');
  }

  // Body paragraph
  private emailText(html: string): string {
    return `
              <tr>
                <td class="m-pad e-body" style="padding:14px 40px 0 40px;font-family:${EMAIL_SANS};font-size:15px;line-height:25px;mso-line-height-rule:exactly;color:#5d6b80;letter-spacing:0.01em;">
                  ${html}
                </td>
              </tr>`;
  }

  // Monospace OTP tile with an uppercase label
  private emailCode(label: string, code: string): string {
    return `
              <tr>
                <td class="m-pad" style="padding:28px 40px 0 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="e-panel" style="background-color:#f7f9fb;border:1px solid #e6ebf2;border-radius:10px;">
                    <tr>
                      <td align="center" class="e-label" style="padding:18px 16px 6px 16px;font-family:${EMAIL_SANS};font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:1.6px;text-transform:uppercase;color:#7b8798;font-weight:500;">
                        ${label}
                      </td>
                    </tr>
                    <tr>
                      <td align="center" class="m-code e-code" style="padding:0 16px 20px 16px;font-family:${EMAIL_MONO};font-size:38px;line-height:46px;mso-line-height-rule:exactly;letter-spacing:11px;color:#1b74d1;font-weight:600;text-indent:11px;">
                        ${code}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
  }

  // Tinted callout. `center` renders the content as a centred mono value instead of a sentence
  private emailNotice(html: string, tone: EmailNoticeTone, center = false): string {
    const palette = EMAIL_NOTICE_TONES[tone];
    const typography = center
      ? `font-family:${EMAIL_MONO};font-size:17px;line-height:26px;font-weight:600;`
      : `font-family:${EMAIL_SANS};font-size:13px;line-height:19px;letter-spacing:0.01em;`;

    return `
              <tr>
                <td class="m-pad" style="padding:16px 40px 0 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="${palette.boxClass}" style="background-color:${palette.background};border-radius:8px;">
                    <tr>
                      <td align="${center ? 'center' : 'left'}" class="${palette.textClass}" style="padding:${center ? '16px 14px' : '11px 14px'};${typography}mso-line-height-rule:exactly;color:${palette.color};">
                        ${html}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
  }

  // Label/value list rendered with monospace values
  private emailFields(fields: { label: string; value: string }[]): string {
    const rows = fields
      .map(
        (field, index) => `
                    <tr>
                      <td class="e-label" style="padding:${index === 0 ? '18px' : '14px'} 18px 0 18px;font-family:${EMAIL_SANS};font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:1.6px;text-transform:uppercase;color:#7b8798;font-weight:500;">
                        ${field.label}
                      </td>
                    </tr>
                    <tr>
                      <td class="e-value" style="padding:4px 18px ${index === fields.length - 1 ? '18px' : '0'} 18px;font-family:${EMAIL_MONO};font-size:15px;line-height:23px;mso-line-height-rule:exactly;color:#1b2434;word-break:break-all;">
                        ${field.value}
                      </td>
                    </tr>`,
      )
      .join('');

    return `
              <tr>
                <td class="m-pad" style="padding:28px 40px 0 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="e-panel" style="background-color:#f7f9fb;border:1px solid #e6ebf2;border-radius:10px;">${rows}
                  </table>
                </td>
              </tr>`;
  }

  // Solid CTA button. Colours are theme-independent so the fill reads the same in light and dark
  private emailButton(href: string, label: string, tone: EmailButtonTone = 'primary'): string {
    const background = EMAIL_BUTTON_TONES[tone];

    return `
              <tr>
                <td class="m-pad" style="padding:24px 40px 0 40px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${background}">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">${label}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${href}" style="display:inline-block;padding:13px 28px;background-color:${background};color:#ffffff;text-decoration:none;border-radius:8px;font-family:${EMAIL_SANS};font-size:15px;line-height:18px;font-weight:600;letter-spacing:0.01em;">${label}</a>
                  <!--<![endif]-->
                </td>
              </tr>`;
  }

  // Hairline rule separating the body from the closing note
  private emailDivider(): string {
    return `
              <tr>
                <td class="m-pad" style="padding:28px 40px 0 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td height="1" class="e-rule" style="height:1px;line-height:1px;font-size:0;background-color:#eef2f7;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>`;
  }

  // Small closing note below the divider
  private emailMuted(html: string): string {
    return `
              <tr>
                <td class="m-pad e-muted" style="padding:18px 40px 0 40px;font-family:${EMAIL_SANS};font-size:13px;line-height:21px;mso-line-height-rule:exactly;color:#7b8798;letter-spacing:0.01em;">
                  ${html}
                </td>
              </tr>`;
  }

  // Renders the email header brand mark: a hosted logo when configured, inline SVG otherwise
  private renderEmailBrand(): string {
    const imgStyle = 'border:0;outline:none;text-decoration:none;width:170px;height:auto;';

    // A hosted PNG is preferred: it is the only form Gmail, Outlook and Yahoo will render
    if (this.logoLightUrl) {
      return `<img src="${this.logoLightUrl}" width="170" height="28" alt="Vritti AI Cloud" class="e-logo-light" style="display:block;${imgStyle}">
            <img src="${this.logoDarkUrl}" width="170" height="28" alt="Vritti AI Cloud" class="e-logo-dark" style="display:none;${imgStyle}">`;
    }

    // Both marks ship; the dark one is revealed by the prefers-color-scheme rule
    return `<div class="e-logo-light" style="display:block;font-size:0;line-height:0;">${VRITTI_CLOUD_LOGO_LIGHT}</div>
            <div class="e-logo-dark" style="display:none;font-size:0;line-height:0;">${VRITTI_CLOUD_LOGO_DARK}</div>`;
  }

  // Frontend base URL for emails that link back into the web app
  private requireFrontendBaseUrl(): string {
    if (!this.frontendBaseUrl) {
      throw new Error('Email service configuration error: Missing FRONTEND_BASE_URL');
    }
    return this.frontendBaseUrl;
  }

  // Renders an OTP expiry window as a pluralised minute count
  private formatExpiry(expiresAt: Date): string {
    const minutes = Math.ceil((expiresAt.getTime() - Date.now()) / 60_000);
    return `${minutes} ${pluralize('minute', minutes)}`;
  }
  private async sendEmail(emailData: {
    to: Array<{ email: string; name?: string }>;
    subject: string;
    htmlContent: string;
    textContent: string;
  }): Promise<void> {
    try {
      const result = await this.brevoClient.transactionalEmails.sendTransacEmail({
        sender: { email: this.senderEmail, name: this.senderName },
        to: emailData.to,
        subject: emailData.subject,
        htmlContent: emailData.htmlContent,
        textContent: emailData.textContent,
      });
      this.logger.debug(`Email sent successfully. Message ID: ${result.messageId}`);
    } catch (err) {
      if (err instanceof BrevoTimeoutError) {
        this.logger.error('Brevo request timed out after retries.');
        throw new Error('Email sending failed: timeout');
      }
      if (err instanceof BrevoError) {
        if (err.statusCode === 429) {
          this.logger.error('Brevo rate limit exceeded after retries.');
          throw new Error('Email sending failed: rate limit exceeded');
        }
        if (err.statusCode === 401) {
          this.logger.error('Brevo authentication failed. Check your API key.');
          throw new Error('Email service authentication failed');
        }
        if (err.statusCode === 400) {
          this.logger.error('Bad request to Brevo API:', err.message);
          throw new Error(`Invalid email parameters: ${err.message}`);
        }
        this.logger.error(`Brevo API error ${err.statusCode}:`, err.message);
        throw new Error(`Email sending failed: ${err.message}`);
      }
      throw err;
    }
  }
}
