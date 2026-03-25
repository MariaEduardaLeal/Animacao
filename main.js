const hero_section_element = document.getElementById("hero");
const hero_video_element = document.getElementById("hero_video");
const scroll_progress_value_element = document.getElementById("scroll_progress_value");
const lead_capture_form_element = document.getElementById("lead_capture_form");
const form_status_message_element = document.getElementById("form_status_message");
const submit_lead_button_element = document.getElementById("submit_lead_button");

let cached_video_duration = 0;
let target_video_time = 0;
let smoothed_video_time = 0;
let animation_frame_identifier = 0;

/**
 * Inicializa a experiencia principal da landing page e conecta os observadores
 * necessarios para controlar o hero por scroll.
 *
 * @returns {void} Nao retorna valor; apenas registra os eventos iniciais.
 */
function initialize_page_experience() {
    if (!hero_section_element || !hero_video_element || !scroll_progress_value_element) {
        return;
    }

    prepare_video_element(hero_video_element);
    register_video_metadata_events(hero_video_element);
    register_scroll_update_events();
    synchronize_video_state_if_ready(hero_video_element);
    start_video_animation_loop();
    update_hero_video_by_scroll();
    initialize_lead_capture_form();
}

/**
 * Configura o elemento de video para impedir reproducao automatica visivel,
 * mantendo o arquivo pronto para que o `currentTime` seja controlado
 * exclusivamente pelo progresso do scroll.
 *
 * @param {HTMLVideoElement} video_element Elemento de video principal da hero.
 * @returns {void} Nao retorna valor; apenas ajusta propriedades operacionais.
 */
function prepare_video_element(video_element) {
    video_element.pause();
    video_element.muted = true;
    video_element.controls = false;
    video_element.playsInline = true;
    video_element.load();
}

/**
 * Registra eventos ligados ao carregamento de metadados do video para que a
 * altura total da secao hero seja calculada com base na duracao real do arquivo.
 *
 * A logica usa a duracao em segundos multiplicada por uma distancia base em
 * viewport heights. Isso garante que, enquanto houver tempo restante no video,
 * ainda exista area de scroll disponivel para manter a secao sticky.
 *
 * @param {HTMLVideoElement} video_element Elemento de video cujo metadata sera lido.
 * @returns {void} Nao retorna valor; apenas conecta listeners de carregamento.
 */
function register_video_metadata_events(video_element) {
    video_element.addEventListener("loadedmetadata", handle_video_metadata_loaded);
    video_element.addEventListener("loadeddata", handle_video_metadata_loaded);
    video_element.addEventListener("canplay", handle_video_metadata_loaded);
}

/**
 * Sincroniza imediatamente o estado do video quando os metadados ja estiverem
 * disponiveis antes do registro dos listeners.
 *
 * Isso evita o cenario em que o browser carrega a duracao muito cedo e o
 * controle por scroll nao e inicializado, fazendo o hero permanecer apenas no
 * primeiro frame estatico.
 *
 * @param {HTMLVideoElement} video_element Elemento de video principal da hero.
 * @returns {void} Nao retorna valor; apenas reaproveita o fluxo de metadata.
 */
function synchronize_video_state_if_ready(video_element) {
    if (video_element.readyState >= 1 && Number.isFinite(video_element.duration)) {
        handle_video_metadata_loaded();
    }
}

/**
 * Registra os eventos de scroll e resize que recalculam continuamente o frame
 * exibido pelo video e o percentual mostrado no card informativo.
 *
 * @returns {void} Nao retorna valor; apenas conecta listeners globais.
 */
function register_scroll_update_events() {
    window.addEventListener("scroll", update_hero_video_by_scroll, { passive: true });
    window.addEventListener("resize", handle_viewport_resized);
}

/**
 * Inicia um loop de animacao responsavel por aproximar suavemente o `currentTime`
 * real do video ate o tempo-alvo calculado pelo scroll.
 *
 * A interpolacao usa a formula:
 * `tempo_suavizado += (tempo_alvo - tempo_suavizado) * 0.18`.
 * Esse fator cria uma resposta mais cinematografica, reduzindo saltos abruptos
 * sem perder a sensacao de controle direto do usuario sobre a animacao.
 *
 * @returns {void} Nao retorna valor; apenas agenda a atualizacao continua.
 */
function start_video_animation_loop() {
    if (animation_frame_identifier) {
        cancelAnimationFrame(animation_frame_identifier);
    }

    const animate_video_frame = () => {
        animation_frame_identifier = window.requestAnimationFrame(animate_video_frame);

        if (!hero_video_element || cached_video_duration <= 0) {
            return;
        }

        smoothed_video_time += (target_video_time - smoothed_video_time) * 0.18;

        if (Math.abs(hero_video_element.currentTime - smoothed_video_time) > 0.01) {
            hero_video_element.currentTime = smoothed_video_time;
        }
    };

    animation_frame_identifier = window.requestAnimationFrame(animate_video_frame);
}

/**
 * Processa o carregamento dos metadados do video, armazena a duracao valida e
 * converte essa duracao em altura da secao hero.
 *
 * O calculo segue a formula:
 * `altura_total_da_hero = 100vh + (duracao_do_video_em_segundos * 115vh)`.
 * O primeiro `100vh` representa o quadro sticky visivel, enquanto o trecho
 * adicional cria a "pista" de scroll responsavel por avancar e recuar o video.
 *
 * @returns {void} Nao retorna valor; apenas recalcula layout e atualiza o frame.
 */
function handle_video_metadata_loaded() {
    if (!hero_video_element || Number.isNaN(hero_video_element.duration)) {
        return;
    }

    cached_video_duration = hero_video_element.duration;
    target_video_time = Math.min(target_video_time, cached_video_duration);
    smoothed_video_time = target_video_time;
    update_hero_section_height(cached_video_duration);
    update_hero_video_by_scroll();
}

/**
 * Recalcula a altura da secao hero quando a viewport muda para manter a mesma
 * sensacao de controle do scroll em telas diferentes.
 *
 * @returns {void} Nao retorna valor; apenas reaplica o calculo responsivo.
 */
function handle_viewport_resized() {
    if (cached_video_duration > 0) {
        update_hero_section_height(cached_video_duration);
    }

    update_hero_video_by_scroll();
}

/**
 * Atualiza a altura da secao hero em `vh` com base na duracao do video.
 *
 * A conta transforma segundos em distancia de scroll:
 * `hero_scroll_distance = 100 + (duracao_em_segundos * 115)`.
 * Assim, cada segundo do video recebe 115vh de area rolavel, criando precisao
 * suficiente para avancar ou recuar o `currentTime` sem liberar a rolagem da
 * pagina antes do ultimo frame.
 *
 * @param {number} video_duration_in_seconds Duracao real do video em segundos.
 * @returns {void} Nao retorna valor; apenas escreve a variavel CSS global.
 */
function update_hero_section_height(video_duration_in_seconds) {
    const scroll_distance_in_viewport_heights = 100 + (video_duration_in_seconds * 115);
    document.documentElement.style.setProperty(
        "--hero_scroll_distance",
        `${scroll_distance_in_viewport_heights}vh`
    );
}

/**
 * Calcula o progresso normalizado do scroll dentro da secao hero.
 *
 * A formula utilizada e:
 * `progresso = (scroll_atual - topo_da_secao) / (altura_da_secao - altura_da_viewport)`.
 * O resultado e limitado entre `0` e `1` para representar, respectivamente,
 * inicio e fim do video. Esse valor tambem faz a secao permanecer sticky ate
 * que o scroll percorra toda a distancia reservada para a animacao.
 *
 * @returns {number} Valor decimal entre 0 e 1 que representa o progresso atual.
 */
function calculate_scroll_progress() {
    if (!hero_section_element) {
        return 0;
    }

    const section_top_position = hero_section_element.offsetTop;
    const section_scrollable_height = Math.max(
        hero_section_element.offsetHeight - window.innerHeight,
        1
    );
    const current_scroll_position = window.scrollY;
    const raw_progress = (current_scroll_position - section_top_position) / section_scrollable_height;

    return Math.min(Math.max(raw_progress, 0), 1);
}

/**
 * Sincroniza o tempo atual do video com o progresso calculado do scroll.
 *
 * O `currentTime` e obtido por:
 * `tempo_alvo = progresso_normalizado * duracao_do_video`.
 * Dessa forma, descer a pagina avanca a reproducao e subir a pagina recua o
 * frame exibido, mantendo o controle estritamente vinculado ao gesto de scroll.
 *
 * @returns {void} Nao retorna valor; apenas atualiza video e indicador visual.
 */
function update_hero_video_by_scroll() {
    if (!hero_video_element || cached_video_duration <= 0) {
        return;
    }

    const current_scroll_progress = calculate_scroll_progress();
    target_video_time = current_scroll_progress * cached_video_duration;
    const progress_in_percentage = Math.round(current_scroll_progress * 100);

    scroll_progress_value_element.textContent = `${String(progress_in_percentage).padStart(2, "0")}%`;
    update_hero_visual_state(current_scroll_progress);
}

/**
 * Atualiza variaveis CSS do hero para sincronizar microanimacoes de texto,
 * overlay e cards com o mesmo progresso que controla o video.
 *
 * A logica escreve o valor decimal normalizado em `--hero_progress`, permitindo
 * que o CSS converta esse numero em deslocamentos, opacidade e escala. Assim,
 * o video e os elementos da interface compartilham a mesma narrativa visual.
 *
 * @param {number} current_scroll_progress Progresso normalizado entre 0 e 1.
 * @returns {void} Nao retorna valor; apenas atualiza variaveis CSS globais.
 */
function update_hero_visual_state(current_scroll_progress) {
    document.documentElement.style.setProperty("--hero_progress", current_scroll_progress.toFixed(4));
    document.documentElement.style.setProperty(
        "--hero_progress_percentage",
        `${Math.round(current_scroll_progress * 100)}%`
    );
}

/**
 * Inicializa a captura de leads no CTA final, conectando validacao visual e um
 * fluxo de envio simulado para demonstrar a experiencia completa do formulario.
 *
 * @returns {void} Nao retorna valor; apenas registra o evento de submit.
 */
function initialize_lead_capture_form() {
    if (!lead_capture_form_element) {
        return;
    }

    lead_capture_form_element.addEventListener("submit", handle_lead_capture_submit);
}

/**
 * Processa o envio do formulario, valida os campos obrigatorios e simula um
 * envio assincrono para apresentar um feedback de conversao funcional.
 *
 * A validacao percorre os campos do formulario, remove estados antigos de erro
 * e acumula mensagens apenas quando valores obrigatorios ou o formato de e-mail
 * nao atendem ao minimo necessario para um lead comercial valido.
 *
 * @param {SubmitEvent} event Evento de submit disparado pelo formulario.
 * @returns {void} Nao retorna valor; apenas atualiza a interface do formulario.
 */
function handle_lead_capture_submit(event) {
    event.preventDefault();

    if (!lead_capture_form_element) {
        return;
    }

    const form_data = new FormData(lead_capture_form_element);
    const validation_result = validate_lead_capture_form(form_data);

    if (!validation_result.is_valid) {
        update_form_status_message(validation_result.message, "error");
        return;
    }

    simulate_lead_submission();
}

/**
 * Valida o conteudo do formulario de captura de leads.
 *
 * O processo verifica nome, e-mail e perfil de interesse. Cada campo invalido
 * recebe uma classe visual de erro para guiar o usuario diretamente ao ajuste
 * necessario antes do envio.
 *
 * @param {FormData} form_data Dados atuais preenchidos no formulario.
 * @returns {{ is_valid: boolean, message: string }} Resultado consolidado da validacao.
 */
function validate_lead_capture_form(form_data) {
    clear_form_error_states();

    const contact_name = String(form_data.get("contact_name") || "").trim();
    const contact_email = String(form_data.get("contact_email") || "").trim();
    const interest_profile = String(form_data.get("interest_profile") || "").trim();

    if (contact_name.length < 3) {
        mark_field_as_invalid("contact_name");
        return {
            is_valid: false,
            message: "Preencha seu nome com pelo menos 3 caracteres."
        };
    }

    if (!is_valid_email_address(contact_email)) {
        mark_field_as_invalid("contact_email");
        return {
            is_valid: false,
            message: "Informe um e-mail valido para receber o contato comercial."
        };
    }

    if (!interest_profile) {
        mark_field_as_invalid("interest_profile");
        return {
            is_valid: false,
            message: "Selecione o perfil de interesse para priorizarmos seu atendimento."
        };
    }

    return {
        is_valid: true,
        message: "Formulario valido."
    };
}

/**
 * Verifica se um endereco de e-mail atende a um padrao basico de estrutura.
 *
 * @param {string} email_address Endereco de e-mail informado pelo usuario.
 * @returns {boolean} `true` quando o formato do e-mail e aceito; caso contrario `false`.
 */
function is_valid_email_address(email_address) {
    const email_validation_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_validation_pattern.test(email_address);
}

/**
 * Marca visualmente um campo invalido adicionando a classe de erro ao `label`
 * que encapsula o controle correspondente.
 *
 * @param {string} field_identifier Identificador do campo que deve receber erro.
 * @returns {void} Nao retorna valor; apenas atualiza a classe CSS do campo.
 */
function mark_field_as_invalid(field_identifier) {
    const field_element = document.getElementById(field_identifier);

    if (!field_element) {
        return;
    }

    const parent_field_element = field_element.closest(".form_field");

    if (parent_field_element) {
        parent_field_element.classList.add("has_error");
    }
}

/**
 * Remove todos os estados visuais de erro dos campos do formulario antes de uma
 * nova tentativa de validacao.
 *
 * @returns {void} Nao retorna valor; apenas limpa classes CSS de erro.
 */
function clear_form_error_states() {
    const field_elements_with_error = document.querySelectorAll(".form_field.has_error");

    field_elements_with_error.forEach((field_element) => {
        field_element.classList.remove("has_error");
    });
}

/**
 * Simula um envio assincrono do lead para demonstrar a experiencia final do CTA.
 *
 * O botao e desabilitado por um curto intervalo para reproduzir o estado de
 * processamento. Ao final, a interface mostra uma mensagem de sucesso e limpa o
 * formulario para uma nova captura.
 *
 * @returns {void} Nao retorna valor; apenas altera estados visuais do formulario.
 */
function simulate_lead_submission() {
    if (!lead_capture_form_element || !submit_lead_button_element) {
        return;
    }

    submit_lead_button_element.disabled = true;
    submit_lead_button_element.textContent = "Enviando...";
    update_form_status_message("Estamos preparando seu atendimento prioritario.", "default");

    window.setTimeout(() => {
        lead_capture_form_element.reset();
        submit_lead_button_element.disabled = false;
        submit_lead_button_element.textContent = "Solicitar contato comercial";
        update_form_status_message(
            "Pedido enviado com sucesso. Nossa equipe comercial vai entrar em contato em breve.",
            "success"
        );
    }, 1200);
}

/**
 * Atualiza a mensagem de status do formulario e aplica a classe visual adequada
 * para erro, sucesso ou estado neutro.
 *
 * @param {string} message_text Texto que deve ser exibido ao usuario.
 * @param {"default" | "error" | "success"} message_variant Tipo visual da mensagem.
 * @returns {void} Nao retorna valor; apenas manipula o bloco de feedback.
 */
function update_form_status_message(message_text, message_variant) {
    if (!form_status_message_element) {
        return;
    }

    form_status_message_element.textContent = message_text;
    form_status_message_element.classList.remove("is_error", "is_success");

    if (message_variant === "error") {
        form_status_message_element.classList.add("is_error");
    }

    if (message_variant === "success") {
        form_status_message_element.classList.add("is_success");
    }
}

document.addEventListener("DOMContentLoaded", initialize_page_experience);
