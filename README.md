# Controle de Patrimônio

Sistema web multiusuário para cadastrar, localizar e controlar bens patrimoniais, com número de barras, leitura por leitor USB ou câmera do celular, histórico de movimentações, inventário por conferência e emissão de etiquetas.

> **Quer esse sistema (ou algo sob medida) na sua empresa?**
> Fale comigo no LinkedIn: **https://www.linkedin.com/in/rikelme-holanda-alves-ba1990288/**
> — Rikelme Holanda · Dados, BI e Sistemas · Hola.com, suas soluções tecnológicas.

> ⚠️ **Este projeto é apenas um MVP (produto mínimo viável) e uma demonstração de aplicação.**
> Em uma contratação real, o sistema é adaptado ao seu negócio: ajusto funcionalidades específicas, faço a **personalização completa** para as necessidades da empresa (campos, fluxos, perfis de acesso, relatórios, identidade visual e integrações) e aplico **melhorias de segurança** adequadas ao ambiente de produção.

---

## Funcionalidades

| Área | O que faz |
|---|---|
| **Login** | Acesso por usuário e senha, sessão de 12 h, opção de lembrar o usuário, mostrar/ocultar senha e bloqueio temporário após muitas tentativas erradas. |
| **Painel** | Total de bens, ativos/manutenção/baixados, valor total, gráficos por categoria e setor e últimas movimentações. |
| **Patrimônios** | Cadastro e edição com número de barras, número, descrição, categoria, setor/local, responsável, situação, valor, data de aquisição e observações. Busca e filtros. |
| **Forma de entrada** | Ao cadastrar você escolhe: **Manual**, **Leitor USB** (campo focado, o leitor "digita" e o cursor avança) ou **Câmera** (leitura pelo navegador). Leitor e câmera reabrem o formulário para cadastrar em sequência. |
| **Detecção de duplicidade** | Número de barras e número são únicos; o sistema avisa ao digitar/ler um código já existente. |
| **Histórico** | Toda criação, transferência (setor/responsável/situação), baixa e edição é registrada com data, usuário e observação. |
| **Inventário** | Escolha um setor, leia os códigos e veja o que foi encontrado, o que **está faltando** e o que está **fora do setor** ou baixado. |
| **Foto do bem** | Anexe a foto pela câmera/galeria do celular ou arquivo; é reduzida automaticamente (1024 px), aparece na lista e no detalhe e pode ser substituída ou removida. |
| **Exportação** | Excel (CSV com acentos e `;`), relatório em PDF (via impressão) e **etiquetas Code 128** prontas para imprimir. |
| **Usuários e perfis** | *Administrador* (gerencia usuários, exclui bens, backup e auditoria), *Usuário* (cadastra e movimenta) e *Consulta* (somente visualiza). |
| **Segurança de acesso** | Política de senha (8+ caracteres, letras e números), troca obrigatória no primeiro acesso e após redefinição, cabeçalhos de segurança (CSP, anti-clickjacking) e cookie `Secure` atrás de HTTPS. |
| **Auditoria** | Registra logins (inclusive falhos), trocas de senha, criação/exclusão de usuários, exclusão de bens, importações e backups, com data, usuário e IP. |
| **Importação em massa** | Envio de planilha CSV com validação linha a linha e relatório de erros. |
| **Backup** | O administrador baixa uma cópia consistente do banco com um clique. |
| **Paginação** | Listas grandes divididas em páginas de 50 itens. |

## Stack utilizada

| Camada | Tecnologia | Por quê |
|---|---|---|
| Servidor | **Node.js 22** (módulo `http` nativo) | Sem dependências externas: nada para instalar, fácil de manter. |
| Banco de dados | **SQLite** (módulo nativo `node:sqlite`) | Um único arquivo (`data/patrimonio.db`), simples de fazer backup. |
| Segurança | `crypto.scrypt` (hash de senha), cookie de sessão `HttpOnly` + `SameSite=Strict`, consultas parametrizadas, checagem de origem | Boas práticas básicas contra roubo de senha, SQL injection e CSRF. |
| Front-end | **HTML + CSS + JavaScript puro** (SPA sem framework) | Leve, rápido no celular, responsivo. |
| Código de barras | Gerador próprio de **Code 128 (subconjunto B)** em SVG | Etiquetas nítidas sem biblioteca. |
| Leitura por câmera | API **`BarcodeDetector`** do navegador | Sem biblioteca; funciona em Chrome/Edge. |

## Como o sistema funciona

```
Navegador (SPA)  ──fetch JSON──▶  server.js (API REST)  ──▶  SQLite (data/patrimonio.db)
 public/app.js                    login, sessões, regras
 public/barcode.js                validações, histórico
```

1. **Login:** `POST /api/login` confere a senha (scrypt) e cria uma sessão guardada no banco; o navegador recebe um cookie `HttpOnly`. Todas as outras rotas exigem esse cookie.
2. **Cadastro:** o formulário envia o bem para `POST /api/assets`. O servidor valida os campos, garante unicidade e grava um movimento do tipo *cadastro*.
3. **Edição/movimentação:** `PUT /api/assets/:id` compara os dados antigos e novos; se setor, responsável ou situação mudaram, grava automaticamente uma *transferência* (ou *baixa*) no histórico.
4. **Inventário:** cria-se uma conferência por setor; cada leitura (`/scan`) marca o bem como encontrado. O resultado separa *encontrados*, *faltantes* e *fora do setor*.
5. **Etiquetas e PDF:** geradas no navegador (SVG) e enviadas para a impressão do sistema (escolha "Salvar como PDF" para gerar arquivo).

### Estrutura de arquivos

```
server.js          API, autenticação, banco e arquivos estáticos
package.json
data/              banco SQLite (criado automaticamente — faça backup deste arquivo)
public/
  index.html       página única (cabeçalho com o ícone do sistema)
  style.css        estilos (responsivo, com modo de impressão)
  app.js           telas: login, painel, patrimônios, inventário, movimentações, usuários
  barcode.js       gerador Code 128
  icon.svg         ícone do sistema (aba do navegador e tela inicial do celular)
```

As fotos ficam em `data/photos/`.

> 📄 Para ver **como o sistema seria ligado ao banco de dados da empresa** (PostgreSQL/SQL Server etc.), leia o [README-BANCO-DE-DADOS.md](README-BANCO-DE-DADOS.md).

## Como rodar

Requisito: **Node.js 22.13 ou superior**.

```bash
node server.js
# ou: npm start
```

- Acesse `http://localhost:3000` (ou `http://IP-DO-PC:3000` na rede, inclusive no celular).
- No **primeiro uso** o console exibe o usuário `admin` e uma **senha provisória aleatória**. O sistema exige a troca dela no primeiro login.
- Porta diferente: `PORT=8080 node server.js`.

### Observações importantes

- **Câmera no celular** exige **HTTPS** (ou `localhost`). Para uso em rede, coloque o sistema atrás de um proxy HTTPS (Caddy, Nginx) ou use um túnel seguro.
- **Backup:** use *Usuários → Baixar backup* ou copie periodicamente a pasta `data/`.
- **Produção:** use HTTPS e mantenha o servidor atrás de um proxy reverso; troque as senhas iniciais.
- A leitura por câmera depende de navegador compatível (Chrome/Edge); o leitor USB funciona em qualquer navegador.

## Do MVP à versão contratada

O que está aqui demonstra a ideia e o fluxo. Na implementação real, entram conforme a necessidade da empresa:

- **Funcionalidades sob medida:** campos, regras e fluxos próprios (aprovação de baixas, depreciação, contratos, anexos e fotos, termos de responsabilidade etc.).
- **Personalização completa:** identidade visual, perfis e permissões detalhados, relatórios e etiquetas no padrão da empresa.
- **Integrações:** ERP, planilhas, e-mail, Active Directory/SSO e importação em massa.
- **Segurança reforçada (além do que já existe no MVP):** HTTPS obrigatório, autenticação em dois fatores, política de senhas e bloqueio de contas, registro de auditoria, backups automáticos e criptografados, revisão de segurança e adequação à LGPD.
- **Infraestrutura:** banco de dados de produção, hospedagem, monitoramento e suporte.

## Contato

Implementação, customização, integração com ERP/planilhas ou treinamento para a sua empresa:
**LinkedIn: https://www.linkedin.com/in/rikelme-holanda-alves-ba1990288/**
